const { parse } = require('csv-parse');
const fs = require('fs');

module.exports = (path, parserOpts) => {
  return new Promise((resolve, reject) => {
    const result = [];

    fs.createReadStream(path)
      .pipe(parse(parserOpts))
      .on('data', (data) => {
        result.push(data);
      })
      .on('end', () => {
        resolve(result);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};
