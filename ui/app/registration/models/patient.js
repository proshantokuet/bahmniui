'use strict';

angular.module('bahmni.registration')
    .factory('patient', ['age', 'identifiers', function (age, identifiers) {
        var create = function () {
            var calculateAge = function () {
                if (this.birthdate) {
                    this.age = age.fromBirthDate(this.birthdate);
                } else {
                    this.age = age.create(null, null, null);
                }
            };

            var calculateBirthDate = function () {
                this.birthdate = age.calculateBirthDate(this.age);
            };

            var fullNameLocal = function () {
                var givenNameLocal = this.givenNameLocal || this.givenName || "";
                var middleNameLocal = this.middleNameLocal || this.middleName || "";
                var familyNameLocal = this.familyNameLocal || this.familyName || "";
                return (givenNameLocal.trim() + " " + (middleNameLocal ? middleNameLocal + " " : "") + familyNameLocal.trim()).trim();
            };

            var getImageData = function () {
                return this.image && this.image.indexOf('data') === 0 ? this.image.replace("data:image/jpeg;base64,", "") : null;
            };

            var identifierDetails = identifiers.create();

            var patient = {
                address: {},
                age: age.create(),
                birthdate: null,
                calculateAge: calculateAge,
                image: '../images/blank-user.gif',
                fullNameLocal: fullNameLocal,
                getImageData: getImageData,
                relationships: [],
                newlyAddedRelationships: [{}],
                deletedRelationships: [],
                calculateBirthDate: calculateBirthDate,
                riskyHabit: {
                    "Cigarette": false,
                    "Tobacco / White Leaf": false,
                    "Others (Tobacco)": false,
                    "Drug Addiction": false,
                    "Obesity": false,
                    "High Salt Intake": false
                },
                diseaseStatus: {
                    "High Blood Pressure": false,
                    "Diabetes": false,
                    "Very severe disease": false,
                    "Pneumonia": false,
                    "Pneumonia unspec": false,
                    "dieria and dysentry": false,
                    "Fever": false,
                    "Measles": false,
                    "Bellybutton Infection": false,
                    "Conjunctivitis unspec": false,
                    "Injury": false,
                    "Hearing loss, unspec": false,
                    "maleria": false,
                    "Tuberculosis": false,
                    "Jaundice": false,
                    "Probable Limited Infection": false,
                    "Diarrhoea No Dehydration": false,
                    "Malnutrition": false,
                    "Anemia": false,
                    "Others member disease": false
                },
                familyDiseaseHistory: {
                    "High Blood Pressure": false,
                    "Diabetes": false,
                    "Tuberculosis": false,
                    "Disability": false,
                    "Psychological Disease": false,
                    "Respiratory Disease": false,
                    "Others (Family Disease)": false
                }
            };
            return _.assign(patient, identifierDetails);
        };

        return {
            create: create
        };
    }]);
