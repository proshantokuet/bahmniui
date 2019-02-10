'use strict';

angular.module('bahmni.clinical').controller('ConsultationController',
    ['$scope', '$rootScope', '$state', '$location', '$translate', '$bahmniCookieStore', 'clinicalAppConfigService', 'diagnosisService', 'urlHelper', 'contextChangeHandler',
        'spinner', 'encounterService', 'messagingService', 'sessionService', 'retrospectiveEntryService', 'patientContext', '$q',
        'patientVisitHistoryService', '$stateParams', '$window', 'visitHistory', 'clinicalDashboardConfig', 'appService',
        'ngDialog', '$filter', 'configurations', 'visitConfig', 'conditionsService', 'configurationService', 'auditLogService', 'patientService',
        function ($scope, $rootScope, $state, $location, $translate, $bahmniCookieStore, clinicalAppConfigService, diagnosisService, urlHelper, contextChangeHandler,
                  spinner, encounterService, messagingService, sessionService, retrospectiveEntryService, patientContext, $q,
                  patientVisitHistoryService, $stateParams, $window, visitHistory, clinicalDashboardConfig, appService,
                  ngDialog, $filter, configurations, visitConfig, conditionsService, configurationService, auditLogService, patientService) {
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var getPreviousActiveCondition = Bahmni.Common.Domain.Conditions.getPreviousActiveCondition;
            $scope.togglePrintList = false;
            $scope.patient = patientContext.patient;
            $scope.showDashboardMenu = false;
            $scope.childRelationships = "";
            $scope.cookieHealthId = new Set();
            $scope.stateChange = function () {
                return $state.current.name === 'patient.dashboard.show';
            };
            $scope.showComment = true;
            $scope.showSaveAndContinueButton = true;

            $scope.visitHistory = visitHistory;
            $scope.consultationBoardLink = clinicalAppConfigService.getConsultationBoardLink();
            $scope.showControlPanel = false;
            $scope.clinicalDashboardConfig = clinicalDashboardConfig;
            $scope.lastvisited = null;

            $scope.openConsultationInNewTab = function () {
                $window.open('#' + $scope.consultationBoardLink, '_blank');
            };

            $scope.toggleDashboardMenu = function () {
                $scope.showDashboardMenu = !$scope.showDashboardMenu;
            };

            $scope.showDashboard = function (dashboard) {
                if (!clinicalDashboardConfig.isCurrentTab(dashboard)) {
                    $scope.$parent.$broadcast("event:switchDashboard", dashboard);
                }
                $scope.showDashboardMenu = false;
            };

            var setPrintAction = function (event, tab) {
                tab.print = function () {
                    $rootScope.$broadcast(event, tab);
                };
            };
            var setDashboardPrintAction = _.partial(setPrintAction, "event:printDashboard", _);
            var setVisitTabPrintAction = function (tab) {
                tab.print = function () {
                    var url = $state.href('patient.dashboard.visitPrint', {
                        visitUuid: visitHistory.activeVisit.uuid,
                        tab: tab.title,
                        print: 'print'
                    });
                    window.open(url, '_blank');
                };
            };

            _.each(visitConfig.tabs, setVisitTabPrintAction);
            _.each(clinicalDashboardConfig.tabs, setDashboardPrintAction);
            $scope.printList = _.concat(clinicalDashboardConfig.tabs, visitConfig.tabs);

            clinicalDashboardConfig.quickPrints = appService.getAppDescriptor().getConfigValue('quickPrints');
            $scope.printDashboard = function (tab) {
                if (tab) {
                    tab.print();
                } else {
                    clinicalDashboardConfig.currentTab.print();
                }
            };

            $scope.allowConsultation = function () {
                return appService.getAppDescriptor().getConfigValue('allowConsultationWhenNoOpenVisit');
            };

            $scope.closeDashboard = function (dashboard) {
                clinicalDashboardConfig.closeTab(dashboard);
                $scope.$parent.$parent.$broadcast("event:switchDashboard", clinicalDashboardConfig.currentTab);
            };

            $scope.closeAllDialogs = function () {
                ngDialog.closeAll();
            };

            $scope.availableBoards = [];
            $scope.configName = $stateParams.configName;

            $scope.getTitle = function (board) {
                return $filter('titleTranslate')(board);
            };

            $scope.showBoard = function (boardIndex) {
                $rootScope.collapseControlPanel();
                return buttonClickAction($scope.availableBoards[boardIndex]);
            };

            $scope.gotoPatientDashboard = function () {
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                if (contextChangeHandler.execute()["allow"]) {
                    var params = {
                        configName: $scope.configName,
                        patientUuid: patientContext.patient.uuid,
                        encounterUuid: undefined
                    };
                    if ($scope.dashboardDirty) {
                        params['dashboardCachebuster'] = Math.random();
                    }
                    $state.go("patient.dashboard.show", params);
                }
            };

            var isLongerName = function (value) {
                return value ? value.length > 18 : false;
            };

            $scope.getShorterName = function (value) {
                return isLongerName(value) ? value.substring(0, 15) + "..." : value;
            };

            $scope.isInEditEncounterMode = function () {
                return $stateParams.encounterUuid !== undefined && $stateParams.encounterUuid !== 'active';
            };

            $scope.enablePatientSearch = function () {
                return appService.getAppDescriptor().getConfigValue('allowPatientSwitchOnConsultation') === true;
            };

            var setCurrentBoardBasedOnPath = function () {
                var currentPath = $location.url();
                var board = _.find($scope.availableBoards, function (board) {
                    if (board.url === "treatment") {
                        return _.includes(currentPath, board.extensionParams ? board.extensionParams.tabConfigName : board.url);
                    }
                    return _.includes(currentPath, board.url);
                });
                if (board) {
                    $scope.currentBoard = board;
                    $scope.currentBoard.isSelectedTab = true;
                }
            };

            var initialize = function () {
                var appExtensions = clinicalAppConfigService.getAllConsultationBoards();
                $scope.adtNavigationConfig = {forwardUrl: Bahmni.Clinical.Constants.adtForwardUrl, title: $translate.instant("CLINICAL_GO_TO_DASHBOARD_LABEL"), privilege: Bahmni.Clinical.Constants.adtPrivilege };
                $scope.availableBoards = $scope.availableBoards.concat(appExtensions);
                $scope.showSaveConfirmDialogConfig = appService.getAppDescriptor().getConfigValue('showSaveConfirmDialog');
                var adtNavigationConfig = appService.getAppDescriptor().getConfigValue('adtNavigationConfig');
                Object.assign($scope.adtNavigationConfig, adtNavigationConfig);
                setCurrentBoardBasedOnPath();
                var relationships = [];
                var houswholdRelationship = {};
                var motherRelationship = {};
                patientService.getRelationships($scope.patient.uuid).then(function (response) {
                    $scope.relationships = response;
                    _.each(response.data.results, function (relationship) {
                        if (relationship.relationshipType.uuid == "03ed3084-4c7a-11e5-9192-080027b662ec") {
                            houswholdRelationship["relationshipType"] = { "uuid": "03ed3084-4c7a-11e5-9192-080027b662ec" };
                            houswholdRelationship["personB"] = { "display": relationship.personB.display, "uuid": relationship.personB.uuid };
                            relationships.push(houswholdRelationship);
                            motherRelationship["relationshipType"] = { "uuid": "03ed79c5-4c7a-11e5-9192-080027b662ec" };
                            motherRelationship["personB"] = { "display": $scope.patient.name, "uuid": $scope.patient.uuid };
                            relationships.push(motherRelationship);
                            $scope.childRelationships = relationships;
                        }
                    });
                });
            };

            $scope.shouldDisplaySaveConfirmDialogForStateChange = function (toState, toParams, fromState, fromParams) {
                if (toState.name.match(/patient.dashboard.show.*/)) {
                    return fromParams.patientUuid != toParams.patientUuid;
                }
                return true;
            };

            var cleanUpListenerStateChangeStart = $scope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
                if ($scope.showSaveConfirmDialogConfig) {
                    if ($rootScope.hasVisitedConsultation && $scope.shouldDisplaySaveConfirmDialogForStateChange(toState, toParams, fromState, fromParams)) {
                        if ($scope.showConfirmationPopUp) {
                            event.preventDefault();
                            spinner.hide(toState.spinnerToken);
                            ngDialog.close();
                            $scope.toStateConfig = {toState: toState, toParams: toParams};
                            $scope.displayConfirmationDialog();
                        }
                    }
                }
                setCurrentBoardBasedOnPath();
            });

            $scope.adtNavigationURL = function (visitUuid) {
                return appService.getAppDescriptor().formatUrl($scope.adtNavigationConfig.forwardUrl, {'patientUuid': $scope.patient.uuid, 'visitUuid': visitUuid});
            };

            var cleanUpListenerErrorsOnForm = $scope.$on("event:errorsOnForm", function () {
                $scope.showConfirmationPopUp = true;
            });

            $scope.displayConfirmationDialog = function (event) {
                if ($rootScope.hasVisitedConsultation && $scope.showSaveConfirmDialogConfig) {
                    if (event) {
                        event.preventDefault();
                        $scope.targetUrl = event.currentTarget.getAttribute('href');
                    }
                    ngDialog.openConfirm({template: '../common/ui-helper/views/saveConfirmation.html', scope: $scope});
                }
            };

            var cleanUpListenerStateChangeSuccess = $scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
                if (toState.name.match(/patient.dashboard.show.+/)) {
                    $rootScope.hasVisitedConsultation = true;
                    $scope.showConfirmationPopUp = true;
                    if ($scope.showSaveConfirmDialogConfig) {
                        $rootScope.$broadcast("event:pageUnload");
                    }
                }
                if ((toState.name === fromState.name) && (fromState.name === "patient.dashboard.show")) {
                    $rootScope.hasVisitedConsultation = false;
                }
            });

            $scope.$on("$destroy", function () {
                cleanUpListenerStateChangeSuccess();
                cleanUpListenerErrorsOnForm();
                cleanUpListenerStateChangeStart();
            });

            $scope.cancelTransition = function () {
                $scope.showConfirmationPopUp = true;
                ngDialog.close();
                delete $scope.targetUrl;
            };

            $scope.saveAndContinue = function () {
                $scope.showConfirmationPopUp = false;
                $scope.save($scope.toStateConfig);
                $window.onbeforeunload = null;
                ngDialog.close();
            };

            $scope.continueWithoutSaving = function () {
                $scope.showConfirmationPopUp = false;
                if ($scope.targetUrl) {
                    $window.open($scope.targetUrl, "_self");
                }
                $window.onbeforeunload = null;
                $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams);
                ngDialog.close();
            };

            var getUrl = function (board) {
                var urlPrefix = urlHelper.getPatientUrl();
                var url = "/" + $stateParams.configName + (board.url ? urlPrefix + "/" + board.url : urlPrefix);
                var queryParams = [];
                if ($state.params.encounterUuid) {
                    queryParams.push("encounterUuid=" + $state.params.encounterUuid);
                }
                if ($state.params.programUuid) {
                    queryParams.push("programUuid=" + $state.params.programUuid);
                }

                if ($state.params.enrollment) {
                    queryParams.push("enrollment=" + $state.params.enrollment);
                }

                if ($state.params.dateEnrolled) {
                    queryParams.push("dateEnrolled=" + $state.params.dateEnrolled);
                }

                if ($state.params.dateCompleted) {
                    queryParams.push("dateCompleted=" + $state.params.dateCompleted);
                }

                var extensionParams = board.extensionParams;
                angular.forEach(extensionParams, function (extensionParamValue, extensionParamKey) {
                    queryParams.push(extensionParamKey + "=" + extensionParamValue);
                });

                if (!_.isEmpty(queryParams)) {
                    url = url + "?" + queryParams.join("&");
                }

                $scope.lastConsultationTabUrl.url = url;
                return $location.url(url);
            };

            $scope.openConsultation = function () {
                if ($scope.showSaveConfirmDialogConfig) {
                    $rootScope.$broadcast("event:pageUnload");
                }
                $scope.closeAllDialogs();
                $scope.collapseControlPanel();
                $rootScope.hasVisitedConsultation = true;
                switchToConsultationTab();
            };

            var switchToConsultationTab = function () {
                if ($scope.lastConsultationTabUrl.url) {
                    $location.url($scope.lastConsultationTabUrl.url);
                } else {
                    // Default tab
                    getUrl($scope.availableBoards[0]);
                }
            };

            var contextChange = function () {
                return contextChangeHandler.execute();
            };

            var buttonClickAction = function (board) {
                if ($scope.currentBoard === board) {
                    return;
                }
                if (!isFormValid()) {
                    $scope.$parent.$broadcast("event:errorsOnForm");
                    return;
                }

                contextChangeHandler.reset();
                _.map($scope.availableBoards, function (availableBoard) {
                    availableBoard.isSelectedTab = false;
                });

                $scope.currentBoard = board;
                $scope.currentBoard.isSelectedTab = true;
                return getUrl(board);
            };

            var preSavePromise = function () {
                var deferred = $q.defer();

                var observationFilter = new Bahmni.Common.Domain.ObservationFilter();
                $scope.consultation.preSaveHandler.fire();
                $scope.lastvisited = $scope.consultation.lastvisited;
                var selectedObsTemplate = $scope.consultation.selectedObsTemplate;
                var tempConsultation = angular.copy($scope.consultation);
                tempConsultation.observations = observationFilter.filter(tempConsultation.observations);
                tempConsultation.consultationNote = observationFilter.filter([tempConsultation.consultationNote])[0];
                tempConsultation.labOrderNote = observationFilter.filter([tempConsultation.labOrderNote])[0];
                addFormObservations(tempConsultation);
                storeTemplatePreference(selectedObsTemplate);
                var visitTypeForRetrospectiveEntries = clinicalAppConfigService.getVisitTypeForRetrospectiveEntries();
                var defaultVisitType = clinicalAppConfigService.getDefaultVisitType();
                var encounterData = new Bahmni.Clinical.EncounterTransactionMapper().map(tempConsultation, $scope.patient, sessionService.getLoginLocationUuid(), retrospectiveEntryService.getRetrospectiveEntry(),
                    visitTypeForRetrospectiveEntries, defaultVisitType, $scope.isInEditEncounterMode(), $state.params.enrollment);
                deferred.resolve(encounterData);
                return deferred.promise;
            };

            var saveConditions = function () {
                return conditionsService.save($scope.consultation.conditions, $scope.patient.uuid)
                    .then(function () {
                        return conditionsService.getConditions($scope.patient.uuid);
                    }).then(function (savedConditions) {
                        return savedConditions;
                    });
            };

            var storeTemplatePreference = function (selectedObsTemplate) {
                var templates = [];
                _.each(selectedObsTemplate, function (template) {
                    var templateName = template.formName || template.conceptName;
                    var isTemplateAlreadyPresent = _.find(templates, function (template) {
                        return template === templateName;
                    });
                    if (_.isUndefined(isTemplateAlreadyPresent)) {
                        templates.push(templateName);
                    }
                });

                var data = {
                    "patientUuid": $scope.patient.uuid,
                    "providerUuid": $rootScope.currentProvider.uuid,
                    "templates": templates
                };

                if (!_.isEmpty(templates)) {
                    localStorage.setItem("templatePreference", JSON.stringify(data));
                }
            };

            var discontinuedDrugOrderValidation = function (removableDrugs) {
                var discontinuedDrugOrderValidationMessage;
                _.find(removableDrugs, function (drugOrder) {
                    if (!drugOrder.dateStopped) {
                        if (drugOrder._effectiveStartDate < moment()) {
                            discontinuedDrugOrderValidationMessage = "Please make sure that " + drugOrder.concept.name + " has a stop date between " + DateUtil.getDateWithoutTime(drugOrder._effectiveStartDate) + " and " + DateUtil.getDateWithoutTime(DateUtil.now());
                            return true;
                        } else {
                            discontinuedDrugOrderValidationMessage = drugOrder.concept.name + " should have stop date as today's date since it is a future drug order";
                            return true;
                        }
                    }
                });
                return discontinuedDrugOrderValidationMessage;
            };

            var addFormObservations = function (tempConsultation) {
                if (tempConsultation.observationForms) {
                    _.remove(tempConsultation.observations, function (observation) {
                        return observation.formNamespace;
                    });
                    _.each(tempConsultation.observationForms, function (observationForm) {
                        if (observationForm.component) {
                            var formObservations = observationForm.component.getValue();
                            _.each(formObservations.observations, function (obs) {
                                tempConsultation.observations.push(obs);
                            });
                        }
                    });
                }
            };

            var isObservationFormValid = function () {
                var valid = true;
                _.each($scope.consultation.observationForms, function (observationForm) {
                    if (valid && observationForm.component) {
                        var value = observationForm.component.getValue();
                        if (value.errors) {
                            messagingService.showMessage('error', "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                            valid = false;
                        }
                    }
                });
                return valid;
            };

            var isFormValid = function () {
                var contxChange = contextChange();
                var shouldAllow = contxChange["allow"];
                var discontinuedDrugOrderValidationMessage = discontinuedDrugOrderValidation($scope.consultation.discontinuedDrugs);
                if (!shouldAllow) {
                    var errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                    messagingService.showMessage('error', errorMessage);
                } else if (discontinuedDrugOrderValidationMessage) {
                    var errorMessage = discontinuedDrugOrderValidationMessage;
                    messagingService.showMessage('error', errorMessage);
                }
                return shouldAllow && !discontinuedDrugOrderValidationMessage && isObservationFormValid();
            };

            var copyConsultationToScope = function (consultationWithDiagnosis) {
                consultationWithDiagnosis.preSaveHandler = $scope.consultation.preSaveHandler;
                consultationWithDiagnosis.postSaveHandler = $scope.consultation.postSaveHandler;
                $scope.$parent.consultation = consultationWithDiagnosis;
                $scope.$parent.consultation.postSaveHandler.fire();
                $scope.dashboardDirty = true;
            };

            var createChild = function (groupMembers, birthDate, i) {
                var genderConceptId = "581ed5fd-bfcd-4852-a8cf-373e54d9b815";
                var nameConceptId = "627aefb4-8de5-4259-94d4-855acf0c3a63";
                var birthWeightConceptId = "d56380f3-c513-47eb-9f02-44ef55c20f28";
                var healthIdConceptId = "ef59006e-cfb7-414c-9890-6055106dba91";
                var name = "";
                var gender = "";
                var birhtWeight = "";
                var sex = "";
                _.each(groupMembers, function (groupMember) {
                    var conceptUuid = groupMember.concept.uuid;
                    if (conceptUuid == genderConceptId) {
                        gender = groupMember.value.name.name;
                    } else if (conceptUuid == nameConceptId) {
                        name = groupMember.value;
                    } else if (conceptUuid == birthWeightConceptId) {
                        birhtWeight = groupMember.value;
                    } else {
                    }
                });
                console.log(groupMembers);
                // var set = new Set();
                // set = $bahmniCookieStore.get($scope.patient.uuid);
                // console.log(set);
                // console.log("Health:" + set.values().next(i).value);
                patientService.getHealthId().then(function (response) {
                    if (gender == "Male") {
                        sex = "M";
                    } else {
                        sex = "F";
                    }
                    groupMembers.push(createGroupMember(response.data.identifiers));
                    // $scope.cookieHealthId.add(response.data.identifiers);
                    // $bahmniCookieStore.put($scope.patient.uuid, $scope.cookieHealthId);
                    createChildPatient(name, name, sex, birthDate, response.data.identifiers);
                });
                return groupMembers;
            };
            var createChildPatient = function (fn, ln, gender, birthDate, healthId) {
                var openMRSPatient = {
                    patient: {
                        person: {
                            names: [
                                {
                                    givenName: fn,
                                    middleName: "fn",
                                    familyName: "fff"
                                }
                            ],
                            addresses: [$scope.patient.address],
                            birthdate: birthDate,
                            gender: gender
                        },
                        identifiers: [{"identifier": healthId, "identifierType": "81433852-3f10-11e4-adec-0800271c1b75", "preferred": true, "voided": false }]
                    }
                };
                openMRSPatient.relationships = $scope.childRelationships;
                console.log("Patient:");
                console.log(openMRSPatient);
                // encounterService.createPatient(openMRSPatient);
            };
            var createGroupMember = function (healthId) {
                var groupMember = {};
                var concept = {};
                concept.name = "healthId";
                concept.uuid = "ef59006e-cfb7-414c-9890-6055106dba91";
                concept.datatype = undefined;
                // concept.conceptClass = "Misc";
                groupMember.concept = concept;
                groupMember.value = healthId;
                groupMember.formNamespace = "Bahmni";
                groupMember.formFieldPath = "ডেলিভারি সেবা.2/19-0";
                groupMember.voided = false;
                groupMember.inactive = false;

                groupMember.groupMembers = [];
                return groupMember;
            };
            $scope.save = function (toStateConfig) {
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                return spinner.forPromise($q.all([preSavePromise(), encounterService.getEncounterType($state.params.programUuid, sessionService.getLoginLocationUuid())]).then(function (results) {
                    var encounterData = results[0];
                    encounterData.encounterTypeUuid = results[1].uuid;
                    var params = angular.copy($state.params);
                    params.cachebuster = Math.random();
                    // console.log("encounterData");
                    // console.log(encounterData);
                    var attributes = [];
                    var formName = "";
                    var childs = [];
                    var birthDate = "";
                    // console.log(encounterData.observations);
                    console.log("Enc:");
                    console.log(encounterData);
                    _.each(encounterData.observations, function (observation) {
                        var formFieldPath = observation.formFieldPath;
                        var splitFormName = formFieldPath.split(".");
                        formName = splitFormName[0];
                        if (formName == "গর্ভাবস্থার তথ্য" || formName == "ডেলিভারি সেবা") {
                            var attribute = {};
                            var conceptUuid = observation.concept.uuid;
                            var attributeType = "";
                            // for 44
                            /* var pregnancyStatusConceptUuid = "e3162bc6-7c67-4620-af44-6d66d6ff664f";
                            var pregnancyStatusAttributeUuid = "44a5a1e0-fa14-4119-a08b-b7ce38e751e1";
                            var lmpConceptUuid = "c45a7e4b-3f10-11e4-adec-0800271c1b75";
                            var lmpAttributeUuid = "f4732414-9db7-48ca-a806-7b806b59569c";
                            var deliveryDateConceptUuid = "aaae5d8c-da92-49a2-914e-63d029b3501f";
                            var deliveryDateTimeConceptUuid = "7150e240-d92d-4f72-9262-ef32d62952c5";
                            var deliveryDateAttributeUuid = "f8a74ac8-dd11-45cd-a867-58a40b071e7e"; */

                            var pregnancyStatusConceptUuid = "58fa4284-a100-450e-91b6-e302032f6bf6";
                            var pregnancyStatusAttributeUuid = "40715084-f03a-4cff-836a-52736fbdc1ff";
                            var lmpConceptUuid = "c45a7e4b-3f10-11e4-adec-0800271c1b75";
                            var lmpAttributeUuid = "260a8a1a-42d1-4d10-805a-3c9750afbd7d";
                            var deliveryDateConceptUuid = "7d5d7073-da00-4a07-8f34-ae299c2c9cb4";
                            var deliveryDateTimeConceptUuid = "7150e240-d92d-4f72-9262-ef32d62952c5";
                            var deliveryDateAttributeUuid = "443763d6-9c53-463b-9b82-518a05c73958";
                            var deliveryDetailConceptId = "41299bce-f9b7-4ac1-99e8-061846546a5d";
                            var birthDateConceptId = "7150e240-d92d-4f72-9262-ef32d62952c5";
                            var value = "";
                            if (conceptUuid == deliveryDetailConceptId) {
                                childs.push(observation.groupMembers);
                            }
                            if (conceptUuid == birthDateConceptId) {
                                birthDate = observation.value.substr(0, 10);
                            }
                            if (conceptUuid == pregnancyStatusConceptUuid) {
                                attributeType = pregnancyStatusAttributeUuid;
                                value = observation.value.uuid;
                                attribute['value'] = value;
                                attribute['attributeType'] = attributeType;
                                attributes.push(attribute);
                            } else if (conceptUuid == lmpConceptUuid) {
                                attributeType = lmpAttributeUuid;
                                value = observation.value;
                                attribute['value'] = value;
                                attribute['attributeType'] = attributeType;
                                attributes.push(attribute);
                            } else if (conceptUuid == deliveryDateConceptUuid) {
                                attributeType = deliveryDateAttributeUuid;
                                value = observation.value;
                                attribute['value'] = value;
                                attribute['attributeType'] = attributeType;
                                attributes.push(attribute);
                            } else if (conceptUuid == deliveryDateTimeConceptUuid) {
                                attributeType = deliveryDateAttributeUuid;
                                var valueWithTime = observation.value;
                                value = valueWithTime.substr(0, 10);
                                attribute['value'] = "Postnatal";
                                attribute['attributeType'] = pregnancyStatusAttributeUuid;
                                attributes.push(attribute);
                                var attribute = {};
                                attribute['value'] = value;
                                attribute['attributeType'] = attributeType;
                                attributes.push(attribute);
                            }
                        } else {

                        }
                    });
                    var patientInfo = {
                        person: {
                            attributes: attributes
                        }
                    };
                    // console.log($scope.patient);
                    var i = 0;
                    _.each(childs, function (child) {
                        console.log("ch");
                        console.log(child);
                        var j = 0;
                        _.each(encounterData.observations, function (observation) {
                            var conceptUuid = observation.concept.uuid;
                            if (conceptUuid == "7150e240-d92d-4f72-9262-ef32d62952c5") {
                                // childs.push(observation.groupMembers);
                                var gms = createChild(child, birthDate, i);
                                encounterData.observations[j].groupMembers = gms;
                            }
                            j++;
                        });
                        i++;
                    });
                    if (attributes.length != 0) {
                       // encounterService.updatePatient(patientInfo, $scope.patient.uuid);
                    }
                    // encounterData
                    console.log(encounterData);
                    return encounterService.create(encounterData)
                        .then(function (saveResponse) {
                            var messageParams = {encounterUuid: saveResponse.data.encounterUuid, encounterType: saveResponse.data.encounterType};
                            auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                            var consultationMapper = new Bahmni.ConsultationMapper(configurations.dosageFrequencyConfig(), configurations.dosageInstructionConfig(),
                                configurations.consultationNoteConcept(), configurations.labOrderNotesConcept(), $scope.followUpConditionConcept);
                            var consultation = consultationMapper.map(saveResponse.data);
                            consultation.lastvisited = $scope.lastvisited;
                            return consultation;
                        }).then(function (savedConsultation) {
                            return spinner.forPromise(diagnosisService.populateDiagnosisInformation($scope.patient.uuid, savedConsultation)
                                                          .then(function (consultationWithDiagnosis) {
                                                              return saveConditions().then(function (savedConditions) {
                                                                  consultationWithDiagnosis.conditions = savedConditions;
                                                                  messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                                              }, function () {
                                                                  consultationWithDiagnosis.conditions = $scope.consultation.conditions;
                                                              }).then(function () {
                                                                  copyConsultationToScope(consultationWithDiagnosis);
                                                                  if ($scope.targetUrl) {
                                                                      return $window.open($scope.targetUrl, "_self");
                                                                  }
                                                                  return $state.transitionTo(toStateConfig ? toStateConfig.toState : $state.current, toStateConfig ? toStateConfig.toParams : params, {
                                                                      inherit: false,
                                                                      notify: true,
                                                                      reload: true
                                                                  });
                                                              });
                                                          }));
                        }).catch(function (error) {
                            var message = Bahmni.Clinical.Error.translate(error) || "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                            messagingService.showMessage('error', message);
                        });
                }));
            };

            initialize();
        }]);
