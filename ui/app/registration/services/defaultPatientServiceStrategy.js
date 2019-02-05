'use strict';

angular.module('bahmni.registration')
    .service('patientServiceStrategy', ['$http', '$q', '$rootScope', function ($http, $q, $rootScope) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;
        var openmrSRPURL = Bahmni.Registration.Constants.opensrpUrl;
        var search = function (config) {
            var defer = $q.defer();
            var patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl + "/patient";
            if (config && config.params.identifier) {
                patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl + "/patient/lucene";
            }
            var onResults = function (result) {
                defer.resolve(result);
            };
            $http.get(patientSearchUrl, config).success(onResults)
                .error(function (error) {
                    defer.reject(error);
                });
            return defer.promise;
        };

        var getByUuid = function (uuid) {
            var url = openmrsUrl + "/ws/rest/v1/patientprofile/" + uuid;
            var config = {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            };

            var defer = $q.defer();
            $http.get(url, config).success(function (result) {
                defer.resolve(result);
            });
            return defer.promise;
        };

        var create = function (patient, jumpAccepted) {
            var healthIds = [];
            var data = new Bahmni.Registration.CreatePatientRequestMapper(moment()).mapFromPatient($rootScope.patientConfiguration.attributeTypes, patient);
            healthIds = data.patient.identifiers;
            var i = 0;
            console.log("okkkoooooooo....:");
            console.log(healthId());
            healthId().then(function (response) {
                console.log("okkk....:");
                console.log(response);
                data.patient.identifiers[0].identifier = response;
            });
            var healthIdobject = {};
            // data.patient.identifiers[0].identifier = healthId();
            // data.patient.identifiers = healthIdobject;
            console.log(data);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile";
            return $http.post(url, data, {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json", "Jump-Accepted": jumpAccepted}
            });
        };

        var update = function (patient, openMRSPatient, attributeTypes) {
            var deferred = $q.defer();
            var data = new Bahmni.Registration.UpdatePatientRequestMapper(moment()).mapFromPatient(attributeTypes, openMRSPatient, patient);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile/" + openMRSPatient.uuid;
            var config = {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json"}
            };
            $http.post(url, data, config).then(function (result) {
                deferred.resolve(result);
            }, function (reason) {
                deferred.resolve(reason);
            });
            return deferred.promise;
        };

        var generateIdentifier = function (patient) {
            var data = {"identifierSourceName": patient.identifierPrefix ? patient.identifierPrefix.prefix : ""};
            var url = openmrsUrl + "/ws/rest/v1/idgen";
            var config = {
                withCredentials: true,
                headers: {"Accept": "text/plain", "Content-Type": "application/json"}
            };
            return $http.post(url, data, config);
        };

        var healthId = function () {
            var url = openmrsUrl + "/ws/rest/v1/healthid/reserved";
            var config = {
                method: "GET",
                withCredentials: false
            };
            var defer = $q.defer();
            $http.get(url, config).success(function (result) {
                defer.resolve(result.identifiers);
            });
            return defer.promise;
        };

        return {
            search: search,
            get: getByUuid,
            create: create,
            update: update,
            generateIdentifier: generateIdentifier,
            healthId: healthId
        };
    }]);
