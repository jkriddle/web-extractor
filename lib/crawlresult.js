var merge = require('merge');

function CrawlResult(opts) {
	this.opts = merge({}, opts);
}

module.exports = CrawlResult();