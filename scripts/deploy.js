import AWS from 'aws-sdk';
import fs from 'fs';
import pkg from '../package.json';

let environment = process.env.NODE_ENV || 'staging';
let bucketName;

if (environment === 'production') {
  bucketName = 'mux-sdks';
} else {
  bucketName = 'mux-sdks-test';
}

let fullVersion = pkg.version;
let majorVersion = fullVersion.split('.')[0];

let file = fs.readFileSync('dist/player-mux.js');
let bucket = new AWS.S3({params: {Bucket: bucketName}});

Promise.all([
  uploadFile(bucket, file, fullVersion),
  uploadFile(bucket, file, majorVersion)
]).then((data) => {
  console.log(data);
  console.log('\n\nSuccess!');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

function uploadFile (bucket, file, version) {
  return new Promise((resolve, reject) => {
    let params = {
      Body: file,
      Key: `yourPlayer/${version}/yourPlayer-mux.js`,
      ACL: 'public-read',
      ContentType: 'application/javascript'
    };

    bucket.upload(params, function (err, data) {
      if (err) {
        return reject(err);
      }

      resolve(data);
    });
  });
}
