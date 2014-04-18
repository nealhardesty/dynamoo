#!/usr/bin/env node
 // Dynamoo
// (C) Neal Hardesty 2013
// A brain damaged AWS Route 53 Updater

// requires
var fs = require('fs');
var request = require('request');
var _ = require("underscore");
var moment = require("moment");

// globals
var backoff = 0;
var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
var hostname = require('os').hostname();
var configFilename = require('path').join(home, ".dynamoo.config.json");
var config = JSON.parse(fs.readFileSync(configFilename, 'utf-8'));
var AWS = require('aws-sdk');
AWS.config.update(config, true);
var r53 = new AWS.Route53();
var requestedZones = _.map(config.domains.split(","), function(zone) {
  return zone + "."
});
var hostnames;
if(config.extrahosts) {
	hostnames = config.extrahosts.split(",");
	hostnames.push(hostname);
} else {
	hostnames = [hostname];
}

// constants
var VERBOSE = true;

function log(msg) {
  VERBOSE && console.log(msg);
}

function onErrDie(err) {
  if (err) {
    log(err);
    process.exit(1);
  }
}

//log(config);
log("hostnames: " + hostnames);

request('http://checkip.dyndns.org', function(err, response, body) {
  onErrDie(err);
  var externalIp = body.replace(/[^0-9\.]/g, "");
  log("externalIp: " + externalIp);

  r53.listHostedZones({}, function(err, hostedZonesResponse) {
    // TODO handle paged zones response
    onErrDie(err);
    hostedZonesResponse.HostedZones.forEach(function(zoneInfo) {
      //log(zoneInfo.Id);
      //log(zoneInfo.Name);
			hostnames.forEach(function(aname) {
        var fullname = aname + "." + zoneInfo.Name;
        if (_.contains(requestedZones, zoneInfo.Name)) {
          //log(zoneInfo.Id + " " + hostname + " " + externalIp);
  
          r53.listResourceRecordSets({
            "HostedZoneId": zoneInfo.Id,
            "StartRecordType": "A",
            "StartRecordName": fullname,
            "MaxItems": "1"
          }, function(err, data) {
            onErrDie(err);
            //log(data);
  
            if (data.ResourceRecordSets.length > 0 && fullname === data.ResourceRecordSets[0].Name && externalIp === data.ResourceRecordSets[0].ResourceRecords[0].Value) {
              log("no update needed for " + fullname);
            } else {
              //log(data);
  
              var crrsParams = {
                "HostedZoneId": zoneInfo.Id,
                "ChangeBatch": {
                  "Comment": "Updated by dynamoo " + moment().format('MMMM Do YYYYY, h:mm:ss a ZZ'),
                  "Changes": []
                }
              };
  
              if (data.ResourceRecordSets && data.ResourceRecordSets[0] && data.ResourceRecordSets[0].Name && data.ResourceRecordSets[0].Name === fullname) {
                crrsParams.ChangeBatch.Changes.push({
                  "Action": "DELETE",
                  "ResourceRecordSet": {
                    "Name": fullname,
                    "Type": "A",
                    "TTL": data.ResourceRecordSets[0].TTL,
                    "ResourceRecords": data.ResourceRecordSets[0].ResourceRecords
                  }
                });
              }
  
              crrsParams.ChangeBatch.Changes.push({
                "Action": "CREATE",
                "ResourceRecordSet": {
                  "Name": fullname,
                  "Type": "A",
                  "TTL": 60,
                  "ResourceRecords": [{
                      "Value": externalIp
                    }
                  ]
                }
              });
  
							// schedule this at backoff * 1000 seconds or else amazon get's unhappy with multiple updates
							setTimeout(function() {
                r53.changeResourceRecordSets(crrsParams, function(err, data) {
                  onErrDie(err);
                  log("updated " + fullname + " to " + externalIp);
                  //log(data);
                });
							}, backoff * 1000);
							backoff++;
            }
          });
        }
			});
    });
  });
});
