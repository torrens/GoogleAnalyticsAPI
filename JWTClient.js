"use strict";

var google = require('googleapis');

module.exports = class JWTClient {
    constructor(jsonFilePath) {
        var jwtFile = require(jsonFilePath);
        this._client = new google.auth.JWT(jwtFile.client_email, null, jwtFile.private_key, ['https://www.googleapis.com/auth/analytics.readonly'], null);
    }

    get client() {
        return this._client;
    }
};