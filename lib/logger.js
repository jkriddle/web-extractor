var log4js = require('log4js');

log4js.configure('config/logger.json', {});
var logger = log4js.getLogger();

module.exports = logger;