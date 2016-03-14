"use strict";

var google = require('googleapis');
var _ = require('lodash');
var async = require('async');
var JWTClient = require('./JWTClient');
var genericQueries = require('./config/genericQueries.json');
var views = require('./config/views.json');
var fs = require('fs');

// Construct a JWTClient
let jwtClient = new JWTClient('./config/JSONWebToken.json');

// Authorize our JSON Web Token
function authorizeClient(callback) {
    jwtClient.client.authorize(function (err, _) {
        if (err) {
            console.log(err);
        }
        callback(err);
    });
}

authorizeClient(function (err) {
    if (err) {
        return;
    }
    executeQueriesForViews(function () {

    });
});

function executeQueriesForViews(callback) {
    async.each(views.views, function (view, callback) {
        let analytics = google.analytics('v3');
        deleteFile(generateFileName(view.viewId));
        executeQuerieForView(analytics, view.viewId, function (err, responses) {
            if (err) {
                console.log('Failed to execute queries for view ' + view.viewId);
            } else {
                _.each(responses, function (response) {
                    let responseData = dataToCSV(response);
                    writeToFile(view.viewId, responseData);
                });
            }
            callback(err);
        });
    }, function (err) {
        callback(err);
    });
}

function executeQuerieForView(analytics, viewId, callback) {
    let responses = [];
    async.each(genericQueries.queries, function (query, callback) {
        executeQuery(analytics, query, viewId, function (err, response) {
            response.queryName = query.queryName;
            responses.push(response);
            callback(err);
        });
    }, function (err) {
        // if any of the queries produced an error, err would equal that error
        if (err) {
            // One of the queries produced an error
            console.log('Query failed: ' + err);
        }
        callback(err, responses);
    });
}

// Execute a query against a specific view
function executeQuery(analytics, query, viewId, callback) {
    // Make query client unique
    query.auth = jwtClient.client;
    query.ids = 'ga:' + viewId;

    // Execute query
    analytics.data.ga.get(query, function (err, response) {
        return callback(err, response);
    });
}

function dataToCSV(queryResponse) {
    //console.log(queryResponse);

    // Columns
    let columnHeadersJSON = queryResponse.columnHeaders;
    let columnHeaders = [];
    _.each(columnHeadersJSON, function (columnHeader) {
        columnHeaders.push({'headerName:': columnHeader.name, 'headerType': columnHeader.dataType});
    });


    let names = [];
    let values = [];
    let rows = queryResponse.rows;
    _.each(rows, function (row) {
        // row is an array of columnHeaders.length elements
        names.push(convertData(columnHeaders[0], row[0]));
        values.push(convertData(columnHeaders[1], row[1]));
    });

    return {
        'viewId': queryResponse.profileInfo.profileId,
        'queryName': queryResponse.queryName,
        'names': names.join(", "),
        'values': values.join(", "),
    };
}

function convertData(columnHeader, data) {
    let dataType = columnHeader.headerType;
    switch (dataType) {
        case 'STRING':
            return data;
        case 'INTEGER':
            return parseInt(data);
        default:
            return data;
    }
}

function generateFileName(viewId) {
    return './' + viewId + '.csv';
}

function deleteFile(fileName) {
    try {
        fs.unlinkSync(fileName);
    } catch (err) {
    }
}

function writeToFile(viewId, responseData) {
    let fileName = generateFileName(viewId);
    fs.appendFileSync(fileName, 'View,' + responseData.viewId + '\n');
    fs.appendFileSync(fileName, 'Query,' + responseData.queryName + '\n');
    fs.appendFileSync(fileName, responseData.names + '\n');
    fs.appendFileSync(fileName, responseData.values + '\n\n');
}