const Promise = require('promise');
const program = require('commander');

const readFile = Promise.denodeify(require('fs').readFile);
const unzipBuffer = Promise.denodeify(require('zlib').unzip);
const parseXmlString = Promise.denodeify(require('xml2js').parseString);
const request = require('request');

const log = console.log;
const log_error = console.error;

const configuration = {
  timeout: 5,
  repeat: 1,
  compressed: false,
  sitemap: false,
  bunch: 1
};

const report = {
  timeout: 0,
  success: 0,
  error: 0
}

run();

function run () {
  defineProgram()
    .then(readConfiguration)
    .then(ensureConfigurationIsValid)
    .then(logConfiguration)
    .then(readStream)
    .then(unzipStream)
    .then(parseFileAndGetUrls)
    .then(pingUrlsAndRepeat)
    .then(logReport)
    .then(null, logAndThrowError);
}

function logAndThrowError (error) {
  log_error(error.stack);
  throw error;
}

function defineProgram () {
  program.version(process.env.npm_package_version);
  program.arguments('<file-path-or-url>');
  program.option('-b, --bunch <count>', "Group requests by bunch of <count> requests and execute them simultaneously (default to " + configuration.bunch + ")");
  program.option('-r, --repeat <count>', "Number of times URLs are pinged (default to " + configuration.repeat + ")");
  program.option('-s, --sitemap', "Parse file as a .xml sitemap");
  program.option('-t, --timeout <seconds>', "Seconds before request timeout (default to " + configuration.timeout + ")");
  program.option('-g, --gzip', "Unzip .gz file");
  return Promise.resolve();
}

function readConfiguration () {
  program.action(function (pathOrUrl) {
    configuration.pathOrUrl = pathOrUrl;
  });
  program.parse(process.argv);

  if (program.bunch && program.bunch.match(/^\d+$/)) {
    configuration.bunch = parseInt(program.bunch, 10);
  }
  if (program.repeat && program.repeat.match(/^\d+$/)) {
    configuration.repeat = parseInt(program.repeat, 10);
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

function ensureConfigurationIsValid () {
  return new Promise(function (resolve, reject) {
    if (typeof configuration.pathOrUrl === 'undefined') {
      reject(new Error("Invalid configuration: no path or url given."));
    } else if (configuration.bunch <= 0) {
      reject(new Error("Invalid configuration: bunchs must contain at least 1 request."));
    } else {
      resolve();
    }
  });
}

function logConfiguration () {
  log("--- Configuration ---");
  log("File path: %s", configuration.pathOrUrl);
  log("Repeat: %d time(s)", configuration.repeat);
  log("Sitemap: %s", configuration.sitemap);
  log("Timeout: %d second(s)", configuration.timeout);
  log("Compressed: %s", configuration.compressed);
  log("Bunch: %d", configuration.bunch);
  log("---\n");
  return Promise.resolve();
}

function readStream () {
  log("Reading file...");
  const pathOrUrl = configuration.pathOrUrl;
  const result = pathOrUrl.match(/^http/) ? _readUrl(pathOrUrl) : readFile(pathOrUrl);
  return result.then(null, function (error) {
    throw new Error("Cannot read file:\n  " + error.message);
  });
}

function unzipStream (stream) {
  log("Unzipping file...");
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
  log("Parsing file and get URLs...");
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
    const remainingRepeat = configuration.repeat - index - 1;
    const pingUrls = function () { return _pings(urls, remainingRepeat) };
    promiseChain = promiseChain.then(pingUrls, pingUrls);
  });
  return promiseChain;
}

function logReport () {
  log("\n--- Report ---");
  log("Success: %d", report.success);
  log("Timeout: %d", report.timeout);
  log("Error: %d", report.error);
  log("---\n");
  return Promise.resolve();
}

function _pings (urls, remaining) {
  log("Pinging urls, %d iteration(s) remaining after this one...", remaining);
  return _bunchsPings(urls.slice());
}

function _bunchsPings (urls) {
  const bunchUrls = urls.splice(0, configuration.bunch);
  if (configuration.bunch !== 1) {
    log("Running %d concurrent pings (%d URLs remaining)...", bunchUrls.length, urls.length);
  }
  const bunchPingsPromise = Promise.all(bunchUrls.map(_ping));
  var allBunchsPingsPromise = bunchPingsPromise;
  if (urls.length > 0) {
    var performNextBunchsPings = function () { return _bunchsPings(urls); };
    allBunchsPingsPromise = allBunchsPingsPromise.then(performNextBunchsPings, performNextBunchsPings);
  }
  return allBunchsPingsPromise;
}

function _ping (url) {
  return new Promise(function (resolve, reject) {
    request({ url: url, timeout: configuration.timeout * 1000, time: true }, function (error, response, body) {
      if (error && error.code === 'ETIMEDOUT') {
        log("  %s TIMEOUT", url);
        report.timeout++;
      } else if (!error) {
        log("  %s %d (%ds)", url, response.statusCode, (response.elapsedTime / 1000).toFixed(2));
        report.success++;
      } else {
        log("  %s %s", url, error);
        report.error++;
      }
      resolve();
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
  log("Getting urls from XML...");
  const urls = xml.urlset.url.map(function (urlElement) {
    return urlElement.loc[0];
  });
  return Promise.resolve(urls);
}

function _times (n, fn) {
  for (var i = 0; i < n; i++) {
    fn(i);
  }
}
