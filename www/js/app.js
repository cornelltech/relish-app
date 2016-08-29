// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('relish', ['ionic', 'LocalStorageModule', 'monospaced.qrcode'])



.constant('DOMAIN', 'https://e3b157ca.ngrok.io/api/v1')



.run(function($rootScope, $ionicPlatform, $urlRouter, $state, ParticipantService) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });

  // check if the user is authenticated
  $rootScope.$on('$locationChangeSuccess', function(evt) {
     // Halt state change from even starting
     evt.preventDefault();
     // Verify the user has a session token
     var sessionToken = ParticipantService.getToken();
     // Continue with the update and state transition if logic allows
     if(sessionToken){
        $urlRouter.sync();
     }else{
        $state.go('register');
     }
   });

})



.config(function(localStorageServiceProvider) {
  localStorageServiceProvider.setPrefix('relish');
})

.config(function($stateProvider, $urlRouterProvider) {
  //
  // For any unmatched url, redirect to /stream
  $urlRouterProvider.otherwise('/prime')
  
  //
  // Set the states
  $stateProvider
    .state('register', {
      url: '/register',  
      templateUrl: 'templates/register.html',
      controller: 'RegisterController'
    })
    
    .state('about', {
      url: '/about',  
      templateUrl: 'templates/about.html',
      controller: 'AboutController'
    })

    .state('permissions', {
      url: '/permissions',  
      templateUrl: 'templates/permissions.html',
      controller: 'PermissionsController'
    })

    .state('settings', {
      url: '/settings',  
      templateUrl: 'templates/settings.html',
      // controller: 'SettingsController'
    })

    .state('questions', {
      url: '/questions',  
      templateUrl: 'templates/questions.html',
      controller: 'QuestionsController'
    })

    .state('prime', {
      url: '/prime',
      templateUrl: 'templates/prime.html',
      controller: 'PrimeController' 
    });
})



.service('ParticipantService', function($q, $http, localStorageService, DOMAIN){
  function getToken(){
    return localStorageService.get('token');
  };
  function cacheToken(token){
    return localStorageService.set('token', token);
  };
  function getCoopId(){
    return localStorageService.get('coopId');
  };
  function cacheCoopId(coopId){
    return localStorageService.set('coopId', coopId);
  };
  
  function registerParticipant(coopId){
    var deferred = $q.defer();
    $http({
      url: DOMAIN + '/participants',
      method: 'POST',
      contentType: "application/json",
      data: { coop_id: coopId }
    }).then(function(r){
      cacheToken(r.data.token);
      cacheCoopId(r.data.coop_id);
      deferred.resolve();
    }).catch(function(e){
      deferred.reject(e);
    });
    
    return deferred.promise;
  };

  return {
    getToken: getToken,
    getCoopId: getCoopId,
    registerParticipant: registerParticipant
  };
})

.service('QuestionService', function($q, $http, ParticipantService, DOMAIN){
  
  function loadQuestions(){
    var deferred = $q.defer();
    var token = ParticipantService.getToken();

    $http({
      url: DOMAIN + '/questions',
      method: 'GET',
      headers: { 'Authorization': 'Token ' + token }
    }).then(function(r){
      deferred.resolve(r.data.results);
    }).catch(function(e){
      deferred.reject(e);
    });

    return deferred.promise;
  }
  function answerQuestion(question, text){
    var deferred = $q.defer();
    var token = ParticipantService.getToken();

    $http({
      url: DOMAIN + '/answers',
      method: 'POST',
      contentType: "application/json",
      headers: { 'Authorization': 'Token ' + token },
      data: { question: question, text: text }
    }).then(function(r){
      deferred.resolve();
    }).catch(function(e){
      deferred.reject(e);
    });

    return deferred.promise;
  }

  return {
    loadQuestions: loadQuestions,
    answerQuestion: answerQuestion
  }
})

.service('StudyService', function($q, $http, localStorageService, ParticipantService, DOMAIN){
  
  function loadStudies(){
    var deferred = $q.defer();
    var token = ParticipantService.getToken();

    $http({
      url: DOMAIN + '/studies',
      method: 'GET',
      headers: { 'Authorization': 'Token ' + token }
    }).then(function(r){
      r.data.results.forEach(function(obj){
        if(obj.active){
          deferred.resolve(obj);
        }
      });
      // deferred.reject( );
    }).catch(function(e){
      deferred.reject(e);
    });

    return deferred.promise;
  }

  function getCondition(conditions){
    console.log("getCondition")
    console.log(conditions)

    var deferred = $q.defer();
    var condition = undefined;
    var lastCondition = undefined;
    
    // get the id of the last condition used
    var lastConditionId = localStorageService.get('lastCondition', -1);

    console.log("lastConditionId")
    console.log(lastConditionId)
    
    // if nothing is used, get the first one
    if( lastConditionId == null ){
      lastCondition = conditions[0];
    }else {
      lastCondition = conditions.find(function(obj, indx){
        return obj.id == lastConditionId;
      });
    }

    console.log("lastCondition")
    console.log(lastCondition)

    // get the next condition in the list
    conditions.forEach(function(obj, indx){
      if(lastCondition.id == obj.id){
        if(indx == conditions.length - 1){
          condition = conditions[0];
        }else{
          condition = conditions[indx + 1];
        }
      }
    });

    console.log("condition")
    console.log(condition)

    // cache
    localStorageService.set('lastCondition', condition.id);

    deferred.resolve(condition);

    return deferred.promise;
  }

  return {
    loadStudies: loadStudies,
    getCondition: getCondition
  }
})


.controller('RegisterController', function($scope, $state, ParticipantService){
  console.log('RegisterController()');
  $scope.coopId = "";

  function registerByCoopId(){
    if($scope.coopId){
      ParticipantService.registerParticipant($scope.coopId)
        .then(function(){
          $state.go('about');
        })
        .catch(function(e){
          console.log(e);
          alert("Something went wrong");
        });
    }else{
      alert("Please enter a valid coop id");
    }
  }
  $scope.registerByCoopId = registerByCoopId;

})

.controller('AboutController', function($scope, $state){
  function goToPermissions(){
    $state.go('permissions');
  }
  $scope.goToPermissions = goToPermissions;
})

.controller('PermissionsController', function($scope, $state){
  function requestPermissions(){
    if(window.cordova && window.geofence){
      window.geofence.initialize().then(function () {
        console.log("Successful initialization");
        $state.go('questions');
      }, function (error) {
        console.log(error);
        alert("Failed to initialize plugin");
        $state.go('questions');
      });
    }else{
      console.log("Plugin not found");
      alert("Plugin not found");
      $state.go('questions');
    }
  }
  $scope.requestPermissions = requestPermissions;
})

.controller('QuestionsController', function($scope, $state, QuestionService){
  $scope.questions = [];
  $scope.answers = [];
  $scope.sliderDelegate = null;
  $scope.options = {
    // allowSwipeToPrev: false,
    // allowSwipeToNext: false
  }

  QuestionService.loadQuestions()
    .then(function(qs){
      console.log(qs);
      $scope.questions = qs;
      $scope.questions.forEach(function(q){ $scope.answers.push(""); });
    })
    .catch(function(error){
      console.log(error);
      alert("Failed to load questions");
    });
  
  function submitAnswer(questionIndx){
    var questionId = $scope.questions[questionIndx].id;
    var answerText = $scope.answers[questionIndx]
    QuestionService.answerQuestion(questionId, answerText)
      .then(function(){
        if(questionIndx + 1 == $scope.questions.length){
          // done with all the qs
          $state.go('prime');
        }else{
          $scope.sliderDelegate.slideNext();
        }
      })
      .catch(function(e){
        console.log(e);
        alert("Something went wrong");
      })

    
  }
  $scope.submitAnswer = submitAnswer;
})

.controller('PrimeController', function($scope, $state, $window, $timeout, StudyService, Geofence){
  var DELAY = 1000;

  $scope.width = 0.85 * $window.innerWidth;
  $scope.isPriming = true;
  $scope.inRegion = true;
  
  $scope.study;
  $scope.condition;
  
  $scope.isDisabled = true;
  function checkActionBtnState(){
    if($scope.inRegion){
      $timeout(function(){
        $scope.isDisabled = false;
      }, DELAY);
    }
  }
  checkActionBtnState();
  

  function syncStudy(){
    StudyService.loadStudies()
      .then(function(study){
        console.log('==============');
        console.log(study);
        console.log('==============');

        $scope.study = study;
        StudyService.getCondition(study.conditions)
          .then(function(r){
            $scope.condition = r;
          })
          .catch(function(e){
            console.log(e);
          });
      })
      .catch(function(e){
        console.log(e);
      });
  }
  syncStudy();

  function showCoupon(){
    $scope.isPriming = false;
  }
  $scope.showCoupon = showCoupon;

  function reset(){
    $scope.inRegion = false;
  }
  $scope.reset = reset;




})

.controller('SettingsController', function($scope){})