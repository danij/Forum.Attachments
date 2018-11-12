const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');

const fileLocation = process.env.FILE_LOCATION;
const tempFileLocation = process.env.TEMP_FILE_LOCATION;

async function fileExists(filePath) {

    return new Promise((resolve, reject) => {

        fs.stat(filePath, (err, stats) => {

            if (err) { reject(err); }
            else { resolve(stats.size > 0); }
        });
    });
}

async function deleteFile(filePath) {

    return new Promise((resolve, reject) => {

        fs.unlink(filePath, err => {
            if (err) { reject(err); }
            else { resolve(); }
        })
    });
}

async function createDirectory(path) {

    return new Promise((resolve, reject) => {

        fs.mkdir(path, {
            recursive: true
        }, err => {
            if (err && (err.code !== 'EEXIST')) { reject(err); }
            else { resolve(); }
        })
    });
}

async function renameFile(oldPath, newPath) {

    return new Promise((resolve, reject) => {

        fs.rename(oldPath, newPath, err => {
            if (err) { reject(err); }
            else { resolve(); }
        })
    });
}

function getAttachmentFilePath(id) {

    const fileName = id.toLowerCase();
    return path.join(fileLocation, ...[...Array(4).keys()].map(i => fileName[i]), id);
}

module.exports = {

    getAttachmentStream: async (id) => {

        const filePath = getAttachmentFilePath(id);
        if ( ! await fileExists(filePath)) return null;

        return fs.createReadStream(filePath);
    },

    prepareAttachmentUpload: () => {

        const tempId = uuidv4();
        const tempFilePath = path.join(tempFileLocation, tempId);

        return {

            tempId: tempId,
            stream: fs.createWriteStream(tempFilePath),
            totalBytes: 0,
            discard: () => deleteFile(tempFilePath),
            persist: async id => {

                const filePath = getAttachmentFilePath(id);
                await createDirectory(path.dirname(filePath));
                await renameFile(tempFilePath, filePath);
            }
        }
    }
};