const Promise = require('promise');
const program = require('commander');

const readFile = Promise.denodeify(require('fs').readFile);
const unzipBuffer = Promise.denodeify(require('zlib').unzip);
const parseXmlString = Promise.denodeify(require('xml2js').parseString);
const request = require('request');

var configuration = {
  timeout: 5,
  repeat: 1,
  compressed: false
};

run();

function run () {
  defineProgram()
    .then(readConfiguration)
    .then(ensureSitemapPathIsSet)
    .then(logConfiguration)
    .then(readStream)
    .then(unzipStream)
    .then(parseXml)
    .then(getUrlsFromXml)
    .then(pingUrlsAndRepeat)
    .then(null, logAndThrowError);
}

function logAndThrowError (error) {
  console.error(error.stack);
  throw error;
}

function defineProgram () {
  program.version(process.env.npm_package_version);
  program.arguments('<sitemap-path>');
  program.option('-r, --repeat <count>', "Number of times URLs are pinged");
  program.option('-t, --timeout <seconds>', "Seconds before request timeout");
  program.option('-g, --gzip', "Decompress file with gzip");
  return Promise.resolve();
}

function readConfiguration () {
  program.action(function (pathArgument) {
    configuration.sitemapPath = pathArgument;
  });
  program.parse(process.argv);

  if (program.repeat && program.repeat.match(/^\d+$/)) {
    configuration.repeat = parseInt(program.repeat);
  }
  if (program.timeout && program.timeout.match(/^\d+(\.\d+)*$/)) {
    configuration.timeout = parseFloat(program.timeout);
  }
  if (program.gzip) {
    configuration.compressed = true;
  }
  return Promise.resolve();
}

function ensureSitemapPathIsSet () {
  return new Promise(function (resolve, reject) {
    if (typeof configuration.sitemapPath === 'undefined') {
      reject(new Error("Cannot ping sitemap: no path given."));
    } else {
      resolve();
    }
  });
}

function logConfiguration () {
  const log = console.log;
  log("--- Configuration ---");
  log("Sitemap path: %s", configuration.sitemapPath);
  log("Repeat: %d time(s)", configuration.repeat);
  log("Timeout: %d second(s)", configuration.timeout);
  log("Compressed: %s", configuration.compressed);
  log("---\n");
  return Promise.resolve();
}

function readStream () {
  console.log("Reading sitemap...");
  return readFile(configuration.sitemapPath).then(null, function (error) {
    throw new Error("Cannot read sitemap file:\n  " + error.message);
  });
}

function unzipStream (stream) {
  console.log("Unzipping file...");
  if (!configuration.compressed) {
    return Promise.resolve(stream);
  }
  return unzipBuffer(stream)
    .then(function (unzippedBuffer) {
      return unzippedBuffer.toString();
    }).then(null, function (error) {
      throw new Error("Cannot unzip sitemap file:\n " + error.message);
    });
}

function parseXml (string) {
  console.log("Parsing file...");
  return parseXmlString(string).then(null, function (error) {
    throw new Error("Cannot parse sitemap file:\n " + error.message);
  });
}

function getUrlsFromXml (xml) {
  console.log("Getting urls from XML...");
  const urlElements = xml.urlset.url;
  const urls = urlElements.map(function (urlElement) {
    return urlElement.loc[0];
  });
  return Promise.resolve(urls);
}

function pingUrlsAndRepeat (urls) {
  var promiseChain = Promise.resolve();
  _times(configuration.repeat, function(index) {
    var remainingRepeat = configuration.repeat - index - 1;
    var pingUrls = function () { return pings(urls, remainingRepeat) };
    promiseChain = promiseChain.then(pingUrls, pingUrls);
  });
  return promiseChain;
}

function pings (urls, remaining) {
  console.log("Pinging urls, %d iteration(s) remaining after this one...", remaining);
  return urls.slice().reduce(function (promiseChain, url) {
    var pingUrl = function () { return ping(url); };
    return promiseChain.then(pingUrl, pingUrl);
  }, Promise.resolve());
}

function ping (url) {
  return new Promise(function (resolve, reject) {
    request({ url: url, timeout: configuration.timeout * 1000, time: true }, function (error, response, body) {
      if (error && error.code === 'ETIMEDOUT') {
        console.log("  %s TIMEOUT", url);
        resolve(response);
      } else if (!error) {
        console.log("  %s %d (%ds)", url, response.statusCode, (response.elapsedTime / 1000).toFixed(2));
        resolve(response);
      } else {
        console.log("  %s %s", url, error);
        reject(error);
      }
    });
  });
}

function _times (n, fn) {
  for (var i = 0; i < n; i++) {
    fn(i);
  }
}
