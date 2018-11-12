const express = require('express');
const router = express.Router();
const axios = require('axios');
const mime = require('mime-types');
const Busboy = require('busboy');

const attachmentStore = require('../services/attachmentStore');

const trustForwardedIP = process.env.TRUST_FORWARDED_IP === 'true';
const forumBackendUri = process.env.FORUM_BACKEND_URI;
const forumBackendOrigin = process.env.FORUM_BACKEND_ORIGIN;

function getImpersonationIp(req) {

    return trustForwardedIP
        ? req.headers['x-forwarded-for']
        : req.connection.remoteAddress;
}

function getImpersonationCookie(req, doubleSubmit) {

    let cookie = "double_submit=" + doubleSubmit;
    const auth = req.cookies['auth'];
    if (auth) {

        cookie += "; auth=" + auth;
    }
    return cookie;
}

function getImpersonationHeaders(req) {

    const doubleSubmit = 'empty';

    return {
        'x-forwarded-for': getImpersonationIp(req),
        'x-double-submit': doubleSubmit,
        Cookie: getImpersonationCookie(req, doubleSubmit),
        Origin: forumBackendOrigin
    }
}

function getImpersonationHeadersFull(req) {

    const doubleSubmit = req.cookies['double_submit'];

    return {
        'x-forwarded-for': getImpersonationIp(req),
        'x-double-submit': req.headers['x-double-submit'] || '',
        Cookie: getImpersonationCookie(req, doubleSubmit),
        Origin: req.headers['origin'] || '',
        Referer: req.headers['referer'] || ''
    }
}

function getResponseObject(response) {

    const data = response.data;
    const index = data.indexOf('{');
    if (index < 0) return null;

    const json = data.substring(index);

    return JSON.parse(json);
}

router.get('/:id', async (req, res) => {

    const id = req.params.id;

    function notFound() {

        res.statusCode = 404;
        res.send('Could not find attachment!');
    }

    if ( ! id.match(/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/i)) {

        notFound();
        return;
    }

    try {
        const response = getResponseObject(await axios({

            method: 'get',
            url: forumBackendUri + '/attachments/try/' + encodeURIComponent(id),
            headers: getImpersonationHeaders(req)
        }));

        const attachment = response ? response.attachment : null;

        if (( ! attachment) || (! attachment.name)) {

            notFound();
            return;
        }

        const stream = await attachmentStore.getAttachmentStream(id);
        if (stream) {

            const responseHeaders = {

                "Content-Length": attachment.size,
                "Content-Type": mime.lookup(attachment.name) || 'application/octet-stream',
                "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(attachment.name) + "\""
            };

            res.writeHead(200, responseHeaders);
            stream.pipe(res);
        }
        else {

            notFound();
        }
    }
    catch(e) {

        res.statusCode = 500;
        res.send('Could not download attachment!');
    }
});

function acceptAllStatusCodes(status) {
    return true;
}

function isStatusOk(status) {
    return (200 <= status) && (status < 300);
}

router.post('/', async (req, res) => {

    const canAddResponseData = await axios({

        method: 'post',
        url: forumBackendUri + '/attachments/can_add',
        headers: getImpersonationHeadersFull(req),
        validateStatus: acceptAllStatusCodes
    });
    if ( ! isStatusOk(canAddResponseData.status)) {

        res.statusCode = canAddResponseData.status;
        res.send(canAddResponseData.data);
        return;
    }
    const canAddResponse = getResponseObject(canAddResponseData);
    const allowedToUpload = canAddResponse.availableBytes || 0;

    const busboy = new Busboy({
        headers: req.headers,
        limits: {
            files: 1,
            fileSize: allowedToUpload + 1
        }
    });

    let upload;

    busboy.on('file', (fieldname, file, filename/*, encoding, mimetype*/) => {

        upload = attachmentStore.prepareAttachmentUpload();
        upload.name = filename;
        upload.size = 0;

        file.on('data', function(data) {

            upload.size += data.length;
        });
        file.on('end', () => {

            upload.stream.end();
        });
        upload.stream.on('finish', async () => {

            if ((1 > upload.size) || (upload.size > allowedToUpload)) {

                await upload.discard();
                res.writeHead(413); //Payload Too Large
            }
            else {
                try {
                    const responseData = await axios({

                        method: 'post',
                        url: forumBackendUri + '/attachments/' + encodeURIComponent(upload.name) + '/' + encodeURIComponent(upload.size),
                        headers: getImpersonationHeadersFull(req),
                        validateStatus: acceptAllStatusCodes
                    });
                    if ( ! isStatusOk(responseData.status)) {
                        await upload.discard();
                    }
                    else {

                        const response = getResponseObject(responseData);
                        if (0 == response.status) {
                            await upload.persist(response.id);
                        }
                        else {
                            await upload.discard();
                        }
                    }
                    res.statusCode = responseData.status;
                    res.send(responseData.data);
                }
                catch(e) {

                    await upload.discard();
                    res.writeHead(500);
                }
            }
            res.end();
        });
        file.pipe(upload.stream);
    });
    req.pipe(busboy);
});

module.exports = router;
