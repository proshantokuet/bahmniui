'use strict';

angular.module('bahmni.registration')
    .controller('PatientCommonController', ['$scope', '$rootScope', '$http', 'patientAttributeService', 'appService', 'spinner', '$location', 'ngDialog', '$window', '$state',
        function ($scope, $rootScope, $http, patientAttributeService, appService, spinner, $location, ngDialog, $window, $state) {
            var autoCompleteFields = appService.getAppDescriptor().getConfigValue("autoCompleteFields", []);
            var showCasteSameAsLastNameCheckbox = appService.getAppDescriptor().getConfigValue("showCasteSameAsLastNameCheckbox");
            var personAttributes = [];
            var caste;
            $scope.showMiddleName = appService.getAppDescriptor().getConfigValue("showMiddleName");
            $scope.showLastName = appService.getAppDescriptor().getConfigValue("showLastName");
            $scope.isLastNameMandatory = $scope.showLastName && appService.getAppDescriptor().getConfigValue("isLastNameMandatory");
            $scope.showBirthTime = appService.getAppDescriptor().getConfigValue("showBirthTime") != null
                ? appService.getAppDescriptor().getConfigValue("showBirthTime") : true;  // show birth time by default
            $scope.genderCodes = Object.keys($rootScope.genderMap);
            $scope.dobMandatory = appService.getAppDescriptor().getConfigValue("dobMandatory") || false;
            $scope.readOnlyExtraIdentifiers = appService.getAppDescriptor().getConfigValue("readOnlyExtraIdentifiers");
            $scope.showSaveConfirmDialogConfig = appService.getAppDescriptor().getConfigValue("showSaveConfirmDialog");
            $scope.showSaveAndContinueButton = false;

            $scope.riskyHabits = [
                { engName: "Cigarette", benName: "বিড়ি/সিগারেট" },
                { engName: "Tobacco / White Leaf", benName: "তামাক/সাদা পাতা" },
                { engName: "Others (Tobacco)", benName: "অন্যান্য তামাক" },
                { engName: "Drug Addiction", benName: "মাদকাসক্ত" },
                { engName: "Obesity", benName: "স্থুলকায়" },
                { engName: "High Salt Intake", benName: "অতিরিক্ত লবন" }
            ];

            $scope.diseaseStatus = [
                { engName: "High Blood Pressure", benName: "উচ্চ রক্তচাপ" },
                { engName: "Diabetes", benName: "ডায়াবেটিস" },
                { engName: "Very severe disease", benName: "খুব মারাত্বক রোগ" },
                { engName: "Pneumonia", benName: "নিউমোনিয়া" },
                { engName: "Pneumonia unspec", benName: "কাশি/সর্দি" },
                { engName: "dieria and dysentry", benName: "ডায়ারিয়া ও আমাশয়" },
                { engName: "Fever", benName: "জ্বর" },
                { engName: "Measles", benName: "হাম" },
                { engName: "Bellybutton Infection", benName: "নাভিতে সংক্রামন" },
                { engName: "Conjunctivitis unspec", benName: "চোখ উঠা" },
                { engName: "Injury", benName: "আঘাত" },
                { engName: "Hearing loss unspec", benName: "কানের সমস্যা" },
                { engName: "maleria", benName: "জ্বর (ম্যালারিয়া)" },
                { engName: "Tuberculosis", benName: "যক্ষ্মা" },
                { engName: "Jaundice", benName: "জন্ডিস" },
                { engName: "Probable Limited Infection", benName: "সম্ভাব্য সীমিত সংক্রামণ" },
                { engName: "Diarrhoea No Dehydration", benName: "পানি স্বল্পতাহীন ডায়রিয়া" },
                { engName: "Malnutrition", benName: "অপুষ্টি" },
                { engName: "Anemia", benName: "রক্ত স্বল্পতা" },
                { engName: "Others member disease", benName: "অন্যান্য অসুখ" }
            ];

            $scope.familyDiseaseHistory = [
                { engName: "High Blood Pressure", benName: "উচ্চ রক্তচাপ" },
                { engName: "Diabetes", benName: "ডায়াবেটিস" },
                { engName: "Tuberculosis", benName: "যক্ষ্মা" },
                { engName: "Disability", benName: "প্রতিবন্ধিতা" },
                { engName: "Psychological Disease", benName: "মানসিক অসুখ" },
                { engName: "Respiratory Disease", benName: "হৃদরোগ" },
                { engName: "Others (Family Disease)", benName: "অন্যান্য" }
            ];

            var dontSaveButtonClicked = false;

            var isHref = false;

            $scope.updateRiskyHabitCheckboxChange = function (risky, isChecked) {
                $scope.patient.riskyHabit[risky] = isChecked;
            };

            $scope.updateDiseaseStatusCheckboxChange = function (disease, isChecked) {
                $scope.patient.diseaseStatus[disease] = isChecked;
            };

            $scope.updatefamilyDiseaseHistoryCheckboxChange = function (disease, isChecked) {
                $scope.patient.familyDiseaseHistory[disease] = isChecked;
            };

            $rootScope.onHomeNavigate = function (event) {
                if ($scope.showSaveConfirmDialogConfig && $state.current.name != "patient.visit") {
                    event.preventDefault();
                    $scope.targetUrl = event.currentTarget.getAttribute('href');
                    isHref = true;
                    $scope.confirmationPrompt(event);
                }
            };

            var stateChangeListener = $rootScope.$on("$stateChangeStart", function (event, toState, toParams) {
                if ($scope.showSaveConfirmDialogConfig && (toState.url == "/search" || toState.url == "/patient/new")) {
                    $scope.targetUrl = toState.name;
                    isHref = false;
                    $scope.confirmationPrompt(event, toState, toParams);
                }
            });

            $scope.confirmationPrompt = function (event, toState) {
                if (dontSaveButtonClicked === false) {
                    if (event) {
                        event.preventDefault();
                    }
                    ngDialog.openConfirm({template: "../common/ui-helper/views/saveConfirmation.html", scope: $scope});
                }
            };

            $scope.continueWithoutSaving = function () {
                ngDialog.close();
                dontSaveButtonClicked = true;
                if (isHref === true) {
                    $window.open($scope.targetUrl, '_self');
                } else {
                    $state.go($scope.targetUrl);
                }
            };

            $scope.cancelTransition = function () {
                ngDialog.close();
                delete $scope.targetUrl;
            };

            $scope.$on("$destroy", function () {
                stateChangeListener();
            });

            $scope.getDeathConcepts = function () {
                return $http({
                    url: Bahmni.Common.Constants.globalPropertyUrl,
                    method: 'GET',
                    params: {
                        property: 'concept.reasonForDeath'
                    },
                    withCredentials: true,
                    transformResponse: [function (deathConcept) {
                        if (_.isEmpty(deathConcept)) {
                            $scope.deathConceptExists = false;
                        } else {
                            $http.get(Bahmni.Common.Constants.conceptSearchByFullNameUrl, {
                                params: {
                                    name: deathConcept,
                                    v: "custom:(uuid,name,set,setMembers:(uuid,display,name:(uuid,name),retired))"
                                },
                                withCredentials: true
                            }).then(function (results) {
                                $scope.deathConceptExists = !!results.data.results.length;
                                $scope.deathConcepts = results.data.results[0] ? results.data.results[0].setMembers : [];
                                $scope.deathConcepts = filterRetireDeathConcepts($scope.deathConcepts);
                            });
                        }
                    }]
                });
            };
            spinner.forPromise($scope.getDeathConcepts());
            var filterRetireDeathConcepts = function (deathConcepts) {
                return _.filter(deathConcepts, function (concept) {
                    return !concept.retired;
                });
            };

            $scope.isAutoComplete = function (fieldName) {
                return !_.isEmpty(autoCompleteFields) ? autoCompleteFields.indexOf(fieldName) > -1 : false;
            };

            $scope.showCasteSameAsLastName = function () {
                personAttributes = _.map($rootScope.patientConfiguration.attributeTypes, function (attribute) {
                    return attribute.name.toLowerCase();
                });
                var personAttributeHasCaste = personAttributes.indexOf("caste") !== -1;
                caste = personAttributeHasCaste ? $rootScope.patientConfiguration.attributeTypes[personAttributes.indexOf("caste")].name : undefined;
                return showCasteSameAsLastNameCheckbox && personAttributeHasCaste;
            };

            $scope.setCasteAsLastName = function () {
                if ($scope.patient.sameAsLastName) {
                    $scope.patient[caste] = $scope.patient.familyName;
                }
            };

            var showSections = function (sectionsToShow, allSections) {
                _.each(sectionsToShow, function (sectionName) {
                    allSections[sectionName].canShow = true;
                    allSections[sectionName].expand = true;
                });
            };

            var hideSections = function (sectionsToHide, allSections) {
                _.each(sectionsToHide, function (sectionName) {
                    allSections[sectionName].canShow = false;
                });
            };

            var executeRule = function (ruleFunction) {
                var attributesShowOrHideMap = ruleFunction($scope.patient);
                var patientAttributesSections = $rootScope.patientConfiguration.getPatientAttributesSections();
                showSections(attributesShowOrHideMap.show, patientAttributesSections);
                hideSections(attributesShowOrHideMap.hide, patientAttributesSections);
            };

            $scope.handleUpdate = function (attribute) {
                var ruleFunction = Bahmni.Registration.AttributesConditions.rules && Bahmni.Registration.AttributesConditions.rules[attribute];
                if (ruleFunction) {
                    executeRule(ruleFunction);
                }
            };

            var executeShowOrHideRules = function () {
                _.each(Bahmni.Registration.AttributesConditions.rules, function (rule) {
                    executeRule(rule);
                });
            };

            $scope.$watch('patientLoaded', function () {
                if ($scope.patientLoaded) {
                    executeShowOrHideRules();
                }
            });

            $scope.getAutoCompleteList = function (attributeName, query, type) {
                return patientAttributeService.search(attributeName, query, type);
            };

            $scope.getDataResults = function (data) {
                return data.results;
            };

            $scope.$watch('patient.familyName', function () {
                if ($scope.patient.sameAsLastName) {
                    $scope.patient[caste] = $scope.patient.familyName;
                }
            });

            $scope.$watch('patient.caste', function () {
                if ($scope.patient.sameAsLastName && ($scope.patient.familyName !== $scope.patient[caste])) {
                    $scope.patient.sameAsLastName = false;
                }
            });

            $scope.selectIsDead = function () {
                if ($scope.patient.causeOfDeath || $scope.patient.deathDate) {
                    $scope.patient.dead = true;
                }
            };

            $scope.disableIsDead = function () {
                return ($scope.patient.causeOfDeath || $scope.patient.deathDate) && $scope.patient.dead;
            };

            $scope.getRiskyHabitArray = function (data) {
                return data.results;
            };
        }]);

