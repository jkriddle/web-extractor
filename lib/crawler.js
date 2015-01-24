var request = require('request'),
	fs = require('fs'),
	path = require('path'),
	merge = require('merge'),
	Promise = require('bluebird'),
	cheerio = require('cheerio'),
	logger = require('./logger'),
	ExtractMatch = require('./extractmatch');

function Crawler(opts) {

	// defaults
	this.opts = {
		crawl : [],
		cache : path.normalize(__dirname + '/../cache'),
		timeout : 3000,
		output : {
			format : "json",
			directory : path.normalize(__dirname + '/../output'),
		}
	};

	if (typeof opts == "string") {
		// Load from file
		this.opts = merge(this.opts, JSON.parse(fs.readFileSync(opts, 'utf8')));
	} else if (opts != undefined) {
		this.opts = merge(this.opts, opts);
	}

	// other attributes
	this._html = null;
	this._indexed = [];

	if (this.opts.cache) {
		if (!fs.existsSync(path.normalize(this.opts.cache))) {
			fs.mkdirSync(path.normalize(this.opts.cache));
		}
	}

	if (this.opts.output) {
		if (this.opts.output.format == "json") {
			if (!fs.existsSync(path.normalize(this.opts.output.directory))) {
				fs.mkdirSync(path.normalize(this.opts.output.directory));
			}
		} else if (this.opts.output.format == "database") {
			throw new Error("Database output not implemented yet. Sorry :-(")
		}
		
	} else {
		throw new Error("No output format specified.");
	}

};

/**
 * Convert URL into system path-friendly format
 */
Crawler.prototype.getCleanUrl = function(url) {
	return url.replace(/[^a-zA-Z0-9 -]/g, '');
}

/**
 * Writes raw data to file cache
 */
Crawler.prototype.writeCache = function(url, data) {
	var _this = this;
	return new Promise(function(resolve, reject) {
		if (!_this.opts.cache) resolve();

		var cleanUrl = _this.getCleanUrl(url);
		fs.writeFile(path.normalize(_this.opts.cache + '/' + cleanUrl), data, function(err) {
			if (!err) resolve();
			else reject(err);
		});
	});
}

/**
 * Writes scraped data to output
 */
Crawler.prototype.writeOutput = function(url, data) {
	var _this = this;
	var cleanUrl = _this.getCleanUrl(url);
	if (_this.opts.output.format == "json") {
		var filePath = path.normalize(_this.opts.output.directory + '/' + cleanUrl);
		logger.debug("Writing output to " + filePath);
		fs.writeFile(filePath, JSON.stringify(data), function(err) {
		logger.debug("Done.");
		});
	} else {
		// @todo -- database
	}
}

/**
 * Read contents of URL from local cachestore
 */
Crawler.prototype.readFromCache = function(url) {
	var _this = this;
	var filePath = path.normalize(_this.opts.cache + '/' + _this.getCleanUrl(url));
	logger.debug("Checking cache: " + filePath);
	return new Promise(function(resolve, reject) {
		fs.readFile(filePath, function(err, data) {
			if (!err) resolve(data);
			else reject(err);
		});
	});
}

/**
 * Retrieve HTML from the specified URL
 */
Crawler.prototype.download = function(url) {
	var _this = this;
	_this._indexed.push(url);

	return new Promise(function(resolve, reject) {

		var doRequest = function(url) {
			request({
				url : url,
				timeout: _this.opts.timeout
			}, function(err, resp, body) {
				if (!err && resp.statusCode == 200) {
					logger.debug("Content found for " + url);
					resolve(body);
				} else if (!err && resp.statusCode != 200) {
					reject("STATUS " + resp.statusCode + " for " + url);
				} else {
					reject(err);
				}
			});
		}

		if (_this.opts.cache) {
			var html = _this.readFromCache(url).then(function(html) {
				logger.debug("Data read from cache: " + url);
				resolve(html);
			}).catch(function(err) {
				logger.debug("Failed to read from cache: " + err.message);
				doRequest(url);
			});
		} else {
			doRequest(url);
		}
	});
};

/**
 * Begin crawling based on the complete configuration file
 */
Crawler.prototype.start = function() {
	var _this = this;
	var complete = 0;
	return new Promise(function(resolve, reject) {
		function checkComplete() {
			if (complete == _this.opts.start.length) resolve();
		}
		for(var i = 0; i < _this.opts.start.length; i++) {
			var rootUrl = _this.getRootUrl(_this.opts.start[i]);
			_this.crawl(rootUrl, _this.opts.start[i], 0).then(function() {
				complete++;
				checkComplete();
			}).catch(function(err) {
				complete++;
				checkComplete();
			});
		}
	});
}

/**
 * Check if URL has already been indexed
 */
Crawler.prototype.hasIndexed = function(url) {
	var _this = this;
	if (_this._indexed.indexOf(url) != -1) return true;
	return false;
}

/**
 * Convert a URL into absolute format
 */
Crawler.prototype.getAbsoluteUrl = function(rootUrl, url) {
	var _this = this;

	var isAbsolute = _this.isAbsoluteUrl(url);

	if (!isAbsolute) {
		url = rootUrl + url;
	}

	return url;
}


/** 
 * Retrieve root URL path (i.e. http://foo.com/bar ==> http://foo.com)
 */
Crawler.prototype.isAbsoluteUrl = function(url) {
	return /^http/.test(url);s
}

/** 
 * Retrieve root URL path (i.e. http://foo.com/bar ==> http://foo.com)
 */
Crawler.prototype.getRootUrl = function(url) {
	var _this = this;
	var arr = url.split("/");
	var url = arr[0] + "//" + arr[2];
	return url;
}

/**
 * Scrape all content according to config
 */
Crawler.prototype.scrape = function(url, html) {
	var _this = this;
	logger.debug("Scraping " + url);

	return new Promise(function(resolve, reject) {
		_this.writeCache(url, html).then(function() {
			_this.loadHtml(html);
			var scraped = {};
			for(var i = 0; i < _this.opts.extract.length; i++) {
				_this.scrapeElement(_this.opts.extract[i], cheerio(html), scraped, null);
			}

			resolve(scraped);
		}).catch(function(err) {
			reject(err);
		});
	});
}

/**
 * Recurive method to scrape contents of a single element based on the config
 */
Crawler.prototype.scrapeElement = function(config, el, scraped, parent) {
	var _this = this;
	var matches = _this.findElements(config.match, el);
	for(var i = 0; i < matches.length; i++) {
		var nextMatch = matches[i];
		var iterate = null;
		if (config.type == "array") {
			iterate = scraped[config.name] = [];
		} else if (config.children) {
			if (parent && parent.type == "array") {
				var iterate = {};
				scraped.push(iterate);
			} else {
				iterate = scraped[config.name] = {};
			}
		} else {
			scraped[config.name] = cheerio(nextMatch).text();
			iterate = scraped;
		}

		if (config.children) {
			for(var j = 0; j < config.children.length; j++) {
				_this.scrapeElement(config.children[j], nextMatch, iterate, config);
			}
		}
	}
	return scraped;
}

/**
 * Recursive function to download a page, index it, find the URLs, and crawl them.
 */
Crawler.prototype.crawl = function(rootUrl, url, depth) {
	var _this = this;

	depth = depth || 0;

	var newRootUrl = rootUrl;

	// if URL is relative, use the root provided
	// otherwise set the new root for future crawls
	if (_this.isAbsoluteUrl(url)) {
		newRootUrl = _this.getRootUrl(url);
	}

	var absoluteUrl =  _this.getAbsoluteUrl(newRootUrl, url);

	logger.debug("Crawling %s at a depth of %d", absoluteUrl, depth);
	return new Promise(function(resolve, reject) {
		_this.download(absoluteUrl).then(function(resp) {

			// scrape data
			_this.scrape(absoluteUrl, resp).then(function(data) {
				logger.debug("Scraped " + url);
				_this.writeOutput(absoluteUrl, data);

				
			}).catch(function(err) {
				logger.error(err);
			})

			if (depth >= _this.opts.maxDepth) return resolve();

			// craw URLs on this page
			var urls = _this.findUrls(resp);
			var complete = 0;

			function checkComplete() {
				if (complete == urls.length) {
					resolve();
				}
			}

			if (urls.length == 0) {
				resolve();
				return;
			}

			logger.info("Found " + urls.length + " urls to crawl.");
			for(var i = 0; i < urls.length; i++) {
				if (_this.hasIndexed(urls[i])) {
					complete++;
					continue;
				}
				_this._indexed.push(urls[i]);
				_this.crawl(newRootUrl, urls[i], depth + 1).then(function() {
					complete++;
					checkComplete();
				}).catch(function(err) {
					complete++;
					checkComplete();
				});
			}
		}).catch(function(err) {
			reject(err);
		})
	});
}

/**
 * Scrape HTML and find all matching elements using jQuery specifier
 */
Crawler.prototype.findElements = function(specifier, root) {
	if (root == undefined) root = this._html.root();
	return cheerio(root).find(specifier);
};

/**
 * Scrape HTML and find all matching URLs
 */
Crawler.prototype.findUrls = function(html) {
	var matches = [];
	for(var i = 0; i < this.opts.crawl.length; i++) {
		var regexp = new RegExp(this.opts.crawl[i], 'gm');
		var m = html.toString().match(regexp);
		if (m) matches = matches.concat(m);
	}

	// return unique items
	return matches.filter(function(item, pos) {
		return matches.indexOf(item) == pos;
	});
};

/**
 * Loads HTML content into crawler for parsing
 */
Crawler.prototype.loadHtml = function(html) {
	this._html = cheerio.load(html);
}

module.exports = Crawler;