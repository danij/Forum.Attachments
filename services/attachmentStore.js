const fs = require('fs');
const path = require('path');

const fileLocation = process.env.FILE_LOCATION;

async function fileExists(filePath) {

    return new Promise((resolve, reject) => {

        fs.stat(filePath, (err, stats) => {

            if (err) {

                reject(err);
            }
            else {

                resolve(stats.size > 0);
            }
        });
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
    }
};