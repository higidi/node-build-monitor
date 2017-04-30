var request = require('request'),
    async = require('async'),
    striptags = require('striptags');

module.exports = function () {
    var self = this,
    queryBuilds = function (callback) {
        requestBuilds(function (error, body) {
            if (error) {
                callback(error);
                return;
            }

            async.map(body, requestBuild, function (error, results) {
                callback(error, results);
            });
        });
    },
    requestBuilds = function (callback) {
        var planUri = self.configuration.url + "/rest/api/latest/result/" + self.configuration.planKey + ".json?includeAllStates=true";
        var urlParams = {
            "os_authType": "basic"
        };

        request({ uri: planUri, qs: urlParams }, function(error, response, body) {
            try {
                var bodyJson = JSON.parse(body);
                callback(error, bodyJson.results.result);
            } catch (parseError) {
                callback(parseError, null);
            }
        });
    },
    requestBuild = function (build, callback) {
        var planUri = self.configuration.url + "/rest/api/latest/result/" + self.configuration.planKey + "/" + build.number + ".json";
        var urlParams = {
            "os_authType": "basic"
        };
        request({ uri: planUri, qs: urlParams }, function(error, response, body) {
            if (error) {
                callback(error);
                return;
            }
            try {
                var bodyJson = JSON.parse(body);
                callback(error, simplifyBuild(bodyJson));
            } catch (parseError) {
                callback(parseError, null);
            }
        });
    },
    simplifyBuild = function (res) {
        return {
            id: self.configuration.slug + '|' + res.number,
            project: res.plan.shortName,
            number: res.number,
            isRunning: !res.finished && res.lifeCycleState === 'InProgress',
            startedAt: getStartedAt(res),
            finishedAt: getFinishedAt(res),
            requestedFor: getAuthors(res.buildReason),
            status: getStatus(res),
            statusText: getStatusText(res),
            reason: striptags(res.buildReason),
            hasErrors: !res.successful,
            hasWarnings: !res.successful,
            url: self.configuration.url + '/browse/' + res.buildResultKey
        };
    },
    getStartedAt = function(res) {
        return new Date(res.buildStartedTime);
    },
    getFinishedAt = function(res) {
        if (!res.finished) {

            return new Date(getStartedAt(res).getTime() + (res.buildDuration || 1));
        }

        return new Date(res.buildCompletedTime);
    },
    getAuthors = function(reason) {
        var urlRegex = /<a[^>]*>([\s\S]*?)<\/a>/g;
        var links = reason.match(urlRegex);
        if (links !== null) {
            return links.map(
                function(url) {
                    return striptags(url);
                }
            ).join(', ');
        }
        return 'System';
    },
    getStatus = function(res) {
        if (!res.finished && res.lifeCycleState === 'InProgress') return "Blue";
        if (!res.finished && res.lifeCycleState === 'NotBuilt') return "Gray";
        if (res.finished && res.successful) return "Green";
        return "Red";
    },
    getStatusText = function(res) {
      if (!res.finished && res.lifeCycleState === 'InProgress') return "InProgress";
      if (!res.finished && res.lifeCycleState === 'NotBuilt') return "Stopped";
      if (res.finished && res.successful) return "Successful";
      return "Failed";
    };

    self.cache = {
        expires: 0,
        projects: {}
    };

    self.configure = function (config) {
        self.configuration = config;

        if (config.username && config.password) {
            var protocol = config.url.match(/(^|\s)(https?:\/\/)/i);
            if (Array.isArray(protocol)) {
                protocol = protocol[0];
                var url = config.url.substr(protocol.length);
                host = protocol + config.username + ":" + config.password + "@" + url;
            }
        }
        self.configuration.url = host || config.url;
    };

    self.check = function (callback) {
        queryBuilds(callback);
    };
};
