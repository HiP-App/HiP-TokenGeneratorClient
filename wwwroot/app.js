﻿/// <reference path="libs/oidc-client.js" />

var config = {
    // token generator is only used for development purposes, so hardcoding "/develop" is fine
    authority: window.location.protocol + "//" + window.location.hostname + "/develop/authv2/",
    client_id: "HiP-TokenGenerator",
    redirect_uri: window.location.protocol + "//" + window.location.host + "/develop/tokengenerator/callback.html",
    post_logout_redirect_uri: window.location.protocol + "//" + window.location.host + "/develop/tokengenerator/index.html",

    // these two will be done dynamically from the buttons clicked, but are
    // needed if you want to use the silent_renew
    response_type: "id_token token",
    scope: "openid profile email HiP-CmsWebApi",

    // this will toggle if profile endpoint is used
    loadUserInfo: true,

    // will revoke (reference) access tokens at logout time
    revokeAccessTokenOnSignout: true,

    // this will allow all the OIDC protocol claims to be visible in the window. normally a client app
    // wouldn't care about them or want them taking up space
    filterProtocolClaims: false
};
Oidc.Log.logger = window.console;
Oidc.Log.level = Oidc.Log.INFO;

var mgr = new Oidc.UserManager(config);

mgr.events.addUserLoaded(function (user) {
    display("#response", { message: "User loaded" });
    showTokens();
});
mgr.events.addUserUnloaded(function () {
    display("#response", { message: "User logged out locally" });
    showTokens();
});
mgr.events.addAccessTokenExpiring(function () {
    display("#response", { message: "Access token expiring..." });
});
mgr.events.addSilentRenewError(function (err) {
    display("#response", { message: "Silent renew error: " + err.message });
});
mgr.events.addUserSignedOut(function () {
    display("#response", { message: "User signed out of OP" });
});

function display(selector, data) {
    if (data && typeof data === 'string') {
        data = JSON.parse(data);
    }
    if (data) {
        data = JSON.stringify(data, null, 2);
    }
    document.querySelector(selector).textContent = data;
}

function showTokens() {
    mgr.getUser().then(function (user) {
        if (user) {
            display("#id-token", user || "");
        }
        else {
            display("#response", { message: "Not logged in" });
        }
    });
}
showTokens();

function handleCallback() {
    mgr.signinRedirectCallback().then(function (user) {
        var hash = window.location.hash.substr(1);
        var result = hash.split('&').reduce(function (result, item) {
            var parts = item.split('=');
            result[parts[0]] = parts[1];
            return result;
        }, {});
        display("#response", result);

        showTokens();
    }, function (error) {
        display("#response", error.message && { error: error.message } || error);
    });
}

function authorize(scope, response_type) {
    var use_popup = false;
    if (!use_popup) {
        mgr.signinRedirect({ scope: scope, response_type: response_type });
    }
    else {
        mgr.signinPopup({ scope: scope, response_type: response_type }).then(function () {
            display("#response", { message: "Logged In" });
        });
    }
}

function logout() {
    mgr.signoutRedirect();
}

function revoke() {
    mgr.revokeAccessToken();
}

function callApi() {
    mgr.getUser().then(function (user) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function (e) {
            if (xhr.status >= 400) {
                display("#ajax-result", {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    wwwAuthenticate: xhr.getResponseHeader("WWW-Authenticate")
                });
            }
            else {
                display("#ajax-result", xhr.response);
            }
        };
        xhr.onerror = function () {
            if (xhr.status === 401) {
                mgr.removeToken();
                showTokens();
            }

            display("#ajax-result", {
                status: xhr.status,
                statusText: xhr.statusText,
                wwwAuthenticate: xhr.getResponseHeader("WWW-Authenticate")
            });
        };
        xhr.open("GET", "http://localhost:5000/App/Annotation/Tags", true);
        xhr.setRequestHeader("Authorization", "Bearer " + user.access_token);
        xhr.send();
    });
}

if (window.location.hash) {
    handleCallback();
}

[].forEach.call(document.querySelectorAll(".request"), function (button) {
    button.addEventListener("click", function () {
        authorize(this.dataset["scope"], this.dataset["type"]);
    });
});

document.querySelector(".logout").addEventListener("click", logout, false);
