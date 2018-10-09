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

module.exports = {

    getAttachmentStream: async (id) => {

        const filePath = path.join(fileLocation, id);
        if ( ! await fileExists(filePath)) return null;

        return fs.createReadStream(filePath);
    }
};