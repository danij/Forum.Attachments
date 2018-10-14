const express = require('express');
const router = express.Router();
const axios = require('axios');
const mime = require('mime-types');
const attachmentStore = require('../services/attachmentStore');

const trustForwardedIP = process.env.TRUST_FORWARDED_IP === 'true';
const forumBackendUri = process.env.FORUM_BACKEND_URI;
const forumBackendOrigin = process.env.FORUM_BACKEND_ORIGIN;

function getImpersonationHeaders(req) {

    const ip = trustForwardedIP
        ? req.headers['x-forwarded-for']
        : req.connection.remoteAddress;

    const doubleSubmit = 'empty';
    let cookie = "double_submit=" + doubleSubmit;

    const auth = req.cookies['auth'];
    if (auth) {

        cookie += "; auth=" + auth;
    }
    return {
        'x-forwarded-for': ip,
        'x-double-submit': doubleSubmit,
        Cookie: cookie,
        Origin: forumBackendOrigin
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
        const response = await axios({

            method: 'get',
            url: forumBackendUri + '/attachments/try/' + encodeURIComponent(id),
            headers: getImpersonationHeaders(req)
        });

        const responseObject = getResponseObject(response);
        const attachment = responseObject ? responseObject.attachment : null;

        if (( ! attachment) || ( ! attachment.name)) {

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

module.exports = router;
