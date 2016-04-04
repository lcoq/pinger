var sitemapPath;
var timeoutSeconds = 5;
var repeat = 1;
var isCompressed = false;

const program = require('commander');
const fs = require('fs');
const parseXml = require('xml2js').parseString;
const request = require('request');
const zlib = require('zlib');

run();

function run () {
  defineProgramAndParseArgs();
  read(sitemapPath, function (buffer) {
    unzip(buffer, function (string) {
      parseUrls(string, pingUrls);
    });
  });
}

function defineProgramAndParseArgs () {
  program.version(process.env.npm_package_version);
  program.arguments('<sitemap-path>');
  program.action(function (sitemapPathArg) { sitemapPath = sitemapPathArg; });
  program.option('-r, --repeat <count>', "Number of times URLs are pinged");
  program.option('-t, --timeout <seconds>', "Seconds before request timeout");
  program.option('-g, --gzip', "Decompress file with gzip");
  program.parse(process.argv);

  if (typeof sitemapPath === 'undefined') {
    throw new Error("Cannot ping sitemap: no path given.");
  }

  if (program.repeat && program.repeat.match(/^\d+$/)) {
    repeat = parseInt(program.repeat);
  }

  if (program.timeout && program.timeout.match(/^\d+(\.\d+)*$/)) {
    timeoutSeconds = parseFloat(program.timeout);
  }

  if (program.gzip) {
    isCompressed = true;
  }

  console.log("--- Configuration ---");
  console.log("Sitemap path: %s", sitemapPath);
  console.log("Repeat: %d time(s)", repeat);
  console.log("Timeout: %ds", timeoutSeconds);
  console.log("Compressed: %s", isCompressed);
  console.log("---\n");
}


function read (filePath, callback) {
  console.log("Reading sitemap...");
  fs.readFile(sitemapPath, function (error, buffer) {
    if (error) {
      throw new Error("Cannot read sitemap file: " + error.toString());
    }
    callback(buffer);
  });
}

function unzip (buffer, callback) {
  if (!isCompressed) {
    callback(buffer);
  } else {
    zlib.unzip(buffer, function (error, unzippedBuffer) {
      if (error) {
        throw new Error("Cannot unzip sitemap file:" + error.toString());
      }
      callback(unzippedBuffer.toString());
    });
  }
}

function parseUrls (string, callback) {
  console.log("Parsing file...");
  parseXml(string, function (error, parsed) {
    if (error) {
      throw new Error("Cannot parse sitemap file " + error.toString());
    }
    var urlElements = parsed.urlset.url;
    var urls = urlElements.map(function (urlElement) {
      return urlElement.loc[0];
    });
    callback(urls);
  });
}

function pingUrls (urls) {
  repeatedPingUrls(urls, repeat);
}

function repeatedPingUrls (urls, remainingRepeat) {
  if (remainingRepeat === 0) {
    console.log("All urls pinged.");
    return;
  }
  console.log("Pinging urls, %d iteration(s) remaining...", remainingRepeat);
  pingUrlsSequentially(urls.slice(), function () {
    repeatedPingUrls(urls, remainingRepeat - 1);
  });
}

function pingUrlsSequentially (urls, callback) {
  var url = urls.shift();
  if (!url) {
    callback();
    return;
  }
  request({ url: url, timeout: timeoutSeconds * 1000 }, function (error, response, body) {
    if (error) {
      console.log(" %s: TIMEOUT", url);
    } else {
      console.log(" %s: %d", url, response.statusCode);
    }
    pingUrlsSequentially(urls, callback);
  });
}
