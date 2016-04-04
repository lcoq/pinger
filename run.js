const Promise = require('promise');
const program = require('commander');

const readFile = Promise.denodeify(require('fs').readFile);
const unzipBuffer = Promise.denodeify(require('zlib').unzip);
const parseXmlString = Promise.denodeify(require('xml2js').parseString);
const request = require('request');

var configuration = {
  timeout: 5,
  repeat: 1,
  compressed: false,
  sitemap: false
};

var report = {
  timeout: 0,
  success: 0,
  error: 0
}

run();

function run () {
  defineProgram()
    .then(readConfiguration)
    .then(ensurePathOrUrlIsSet)
    .then(logConfiguration)
    .then(readStream)
    .then(unzipStream)
    .then(parseFileAndGetUrls)
    .then(pingUrlsAndRepeat)
    .then(logReport)
    .then(null, logAndThrowError);
}

function logAndThrowError (error) {
  console.error(error.stack);
  throw error;
}

function defineProgram () {
  program.version(process.env.npm_package_version);
  program.arguments('<file-path-or-url>');
  program.option('-r, --repeat <count>', "Number of times URLs are pinged");
  program.option('-s, --sitemap', "Parse file as a xml sitemap");
  program.option('-t, --timeout <seconds>', "Seconds before request timeout");
  program.option('-g, --gzip', "Decompress file with gzip");
  return Promise.resolve();
}

function readConfiguration () {
  program.action(function (pathOrUrl) {
    configuration.pathOrUrl = pathOrUrl;
  });
  program.parse(process.argv);

  if (program.repeat && program.repeat.match(/^\d+$/)) {
    configuration.repeat = parseInt(program.repeat);
  }
  if (program.sitemap) {
    configuration.sitemap = true;
  }
  if (program.timeout && program.timeout.match(/^\d+(\.\d+)*$/)) {
    configuration.timeout = parseFloat(program.timeout);
  }
  if (program.gzip) {
    configuration.compressed = true;
  }
  return Promise.resolve();
}

function ensurePathOrUrlIsSet () {
  return new Promise(function (resolve, reject) {
    if (typeof configuration.pathOrUrl === 'undefined') {
      reject(new Error("Cannot ping file: no path or url given."));
    } else {
      resolve();
    }
  });
}

function logConfiguration () {
  const log = console.log;
  log("--- Configuration ---");
  log("File path: %s", configuration.pathOrUrl);
  log("Repeat: %d time(s)", configuration.repeat);
  log("Timeout: %d second(s)", configuration.timeout);
  log("Compressed: %s", configuration.compressed);
  log("---\n");
  return Promise.resolve();
}

function readStream () {
  console.log("Reading file...");
  const pathOrUrl = configuration.pathOrUrl;
  const result = pathOrUrl.match(/^http/) ? _readUrl(pathOrUrl) : readFile(pathOrUrl);
  return result.then(null, function (error) {
    throw new Error("Cannot read file:\n  " + error.message);
  });
}

function unzipStream (stream) {
  console.log("Unzipping file...");
  if (!configuration.compressed) {
    return Promise.resolve(stream.toString());
  }
  return unzipBuffer(stream)
    .then(function (unzippedBuffer) {
      return unzippedBuffer.toString();
    })
    .then(null, function (error) {
      throw new Error("Cannot unzip file:\n " + error.message);
    });
}

function parseFileAndGetUrls (string) {
  console.log("Parsing file and get URLs...");
  if (configuration.sitemap) {
    return parseXmlString(string)
      .then(_getUrlsFromXml)
      .then(null, function (error) {
        throw new Error("Cannot parse file:\n " + error.message);
      });
  } else {
    return Promise.resolve(string.split("\n"));
  }
}

function pingUrlsAndRepeat (urls) {
  var promiseChain = Promise.resolve();
  _times(configuration.repeat, function (index) {
    var remainingRepeat = configuration.repeat - index - 1;
    var pingUrls = function () { return _pings(urls, remainingRepeat) };
    promiseChain = promiseChain.then(pingUrls, pingUrls);
  });
  return promiseChain;
}

function logReport () {
  const log = console.log;
  log("\n--- Report ---");
  log("Success: %d", report.success);
  log("Timeout: %d", report.timeout);
  log("Error: %d", report.error);
  log("---\n");
  return Promise.resolve();
}

function _pings (urls, remaining) {
  console.log("Pinging urls, %d iteration(s) remaining after this one...", remaining);
  const allPingsChain = urls.slice().reduce(function (promiseChain, url) {
    var pingUrl = function () { return _ping(url); };
    return promiseChain.then(pingUrl, pingUrl);
  }, Promise.resolve());
  // ensure nexts #then does not fail when every ping has failed
  return allPingsChain.then(Promise.resolve, Promise.resolve);
}

function _ping (url) {
  return new Promise(function (resolve, reject) {
    request({ url: url, timeout: configuration.timeout * 1000, time: true }, function (error, response, body) {
      if (error && error.code === 'ETIMEDOUT') {
        console.log("  %s TIMEOUT", url);
        report.timeout++;
        resolve(response);
      } else if (!error) {
        console.log("  %s %d (%ds)", url, response.statusCode, (response.elapsedTime / 1000).toFixed(2));
        report.success++;
        resolve(response);
      } else {
        console.log("  %s %s", url, error);
        report.error++;
        reject(error);
      }
    });
  });
}

function _readUrl (url) {
  return new Promise(function (resolve, reject) {
    request({ url: url, encoding: null }, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

function _getUrlsFromXml (xml) {
  console.log("Getting urls from XML...");
  const urlElements = xml.urlset.url;
  const urls = urlElements.map(function (urlElement) {
    return urlElement.loc[0];
  });
  return Promise.resolve(urls);
}

function _times (n, fn) {
  for (var i = 0; i < n; i++) {
    fn(i);
  }
}
