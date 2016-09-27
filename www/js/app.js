// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('relish', ['ionic', 'ngCordova', 'LocalStorageModule', 'monospaced.qrcode'])



// .constant('DOMAIN', 'https://e3b157ca.ngrok.io/api/v1')
.constant('DOMAIN', 'http://ec2-54-152-205-200.compute-1.amazonaws.com/api/v1')



.run(function($rootScope, $window, $ionicLoading, $ionicPlatform, $urlRouter, $state, ParticipantService) {
  $ionicPlatform.ready(function() {
    if($window.cordova && $window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if($window.StatusBar) {
      StatusBar.styleDefault();
    }
  });

  // check if the user is authenticated
  $rootScope.$on('$locationChangeSuccess', function(evt) {
     console.log("Checking for authentication token");
     // Halt state change from even starting
     evt.preventDefault();
     // Verify the user has a session token
     var sessionToken = ParticipantService.getToken();
     // Continue with the update and state transition if logic allows
     if(sessionToken){
       console.log("Token found, continue");
       $urlRouter.sync();
     }else{
       console.log("Token not found, go to register");
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
          
          console.log("================>StudyService.loadStudies<================");
          console.log(obj);
          console.log("================>/StudyService.loadStudies<================");

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
    var deferred = $q.defer();
    var condition = undefined;
    var lastCondition = undefined;
    
    // get the id of the last condition used
    var lastConditionId = localStorageService.get('lastCondition', -1);

    // if nothing is used, get the first one
    if( lastConditionId == null ){
      lastCondition = conditions[0];
    }else {
      lastCondition = conditions.find(function(obj, indx){
        return obj.id == lastConditionId;
      });
      if( lastCondition == null ){
        lastCondition = conditions[0];
      }
    }

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

    // cache
    localStorageService.set('lastCondition', condition.id);

    console.log("================>StudyService.getCondition<================");
    console.log(condition);
    console.log("================>/StudyService.getCondition<================");

    deferred.resolve(condition);

    return deferred.promise;
  }

  return {
    loadStudies: loadStudies,
    getCondition: getCondition
  }
})

.service('GeoService', function($q, $window, $ionicPlatform){
  var currentCoords = {lat: 90, lng: 180};
  var watchId = null;
  
  var options = {
    // Application config
    debug: false,
    stopOnTerminate: false,
    startOnBoot: true
  };

  function getDistance(lat1,lon1,lat2,lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c * 1000; // Distance in m

    return d;
  }

  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }
  
  function initBackgroundLocation(){
    console.log("================>initBackgroundLocation<================");

    var deferred = $q.defer();
    navigator.geolocation.getCurrentPosition(function(position){
      deferred.resolve();
    }, function(e){
      deferred.reject(e);
    });

    console.log("================>/initBackgroundLocation<================");
    return deferred.promise;
  }

  function configureGeofence(options){
    // {
    //   identifier: "Geofence 1",
    //   notifyOnEntry: true,
    //   notifyOnExit: true,
    //   radius: 200,
    //   latitude: 45.5248868,
    //   longitude:  -73.6424362
    // }
    console.log("configureGeofence")
    console.log(options)
    var deferred = $q.defer();

    $ionicPlatform.ready(function() {
      
    });

    deferred.resolve();
    return deferred.promise;
  }

  return {
    currentCoords: currentCoords,
    initBackgroundLocation: initBackgroundLocation,
    configureGeofence: configureGeofence,
    getDistance: getDistance
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

.controller('PermissionsController', function($scope, $state, $window, $ionicPlatform, GeoService){
  permissionsGranted = 0;
  $scope.geoPermissionsReqVisible = true;
  $scope.pushPermissionsReqVisible = false;
  
  function requestGeoPermissions(){
    $ionicPlatform.ready(function(){
      GeoService.initBackgroundLocation()
        .then(function(){
          permissionsGranted += 1;
          $scope.geoPermissionsReqVisible = false;
          $scope.pushPermissionsReqVisible = true;
        });
    });

  }
  $scope.requestGeoPermissions = requestGeoPermissions;

  function requestPushPermissions(){
    $ionicPlatform.ready(function(){
      if($window.cordova && $window.cordova.plugins.notification.local){
          $window.cordova.plugins.notification.local.registerPermission(function (granted) {
            console.log('Permission has been granted: ' + granted);
            permissionsGranted += 1;
            shouldProceed();
          });
      }else{
          console.log("missing local notification plugin");
      }

    });
  }
  $scope.requestPushPermissions = requestPushPermissions; 

  function shouldProceed(){
    if(permissionsGranted >= 2){
      $state.go('questions');
    }
  }

})

.controller('QuestionsController', function($scope, $state,  QuestionService){
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

.controller('PrimeController', function($scope, $state, $q, $window, $timeout, $ionicPlatform, localStorageService, StudyService, GeoService){
  console.log('=============================================');
  console.log('PrimeController');

  var CONST = 1.75;
  var DELAY = 1000; //ms
  var RADIUS = 50; //m
  var WAIT = 2; // hrs
  var watchId = null;

  $scope.width = 0.85 * $window.innerWidth;
  $scope.isPriming = true;
  $scope.inRegion = false;
  
  $scope.study;
  $scope.condition;

  $scope.DEBUG = true;
  $scope.currentCoords = GeoService.currentCoords;
  $scope.regionCoords = {lat: 0, lng: 0};
  $scope.dist = 0;
  $scope.radius = RADIUS;  

  function updateOnCoordChange(){
    // run this on var changes to see if regions overlap 

    // figure out if we are in the region of interest
    var dist = GeoService.getDistance($scope.currentCoords.lat, $scope.currentCoords.lng, $scope.regionCoords.lat, $scope.regionCoords.lng);
    $scope.dist = dist;

    // get last time the coupon was viewed
    var now = new Date();
    var lastTimestamp = new Date( localStorageService.get('last', 0) );

    if(dist <= CONST*RADIUS && WAIT <= diff2Dates(now, lastTimestamp) ){
      // proceed if in region
      $scope.inRegion = true;
    }else{
      // not in region
      $scope.inRegion = false;
    }
    checkActionBtnState();
  }

  
  $scope.isDisabled = true;
  function checkActionBtnState(){
    if($scope.inRegion){
      $timeout(function(){
        $scope.isDisabled = false;
      }, DELAY);
    }else{
      $scope.isDisabled = true;
    }
  }

  function showCoupon(){
    $scope.isPriming = false;
  }
  $scope.showCoupon = showCoupon;

  function reset(){
    $scope.inRegion = false;
    $scope.isPriming = true;
    checkActionBtnState();
    var now = new Date();
    localStorageService.set('last', now.toString());
  }
  $scope.reset = reset;

  
  function diff2Dates(d1, d2){
    // returns in hours
    var timeDiff = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600)); 
  }

  function sync(){
    StudyService.loadStudies()
      .then(function(study){
        $scope.study = study;
        $scope.regionCoords = {lat: study.region.lat, lng: study.region.lng};
        
        GeoService.configureGeofence({
          identifier: $scope.study.region.description,
          notifyOnEntry: true,
          notifyOnExit: false,
          radius: RADIUS,
          latitude: $scope.study.region.lat,
          longitude:  $scope.study.region.lng
        });

        StudyService.getCondition($scope.study.conditions)
          .then(function(r){
            $scope.condition = r;
          })
          .catch(function(e){
            console.log(e);
          });
        
      })
      .catch(function(e){
        console.log(e);
        alert("Failed to sync study");
      });
  }


  // watchers
  $scope.$watch('currentCoords', function() {
    console.log('=============currentCoords==================');
    updateOnCoordChange();
    console.log('============/currentCoords==================');
  });
  $scope.$watch('regionCoords', function() {
    console.log('=============regionCoords==================');
    updateOnCoordChange();
    console.log('============/regionCoords==================');
  });
  
  $ionicPlatform.ready(function() {

    document.addEventListener("deviceready", function(){
      
      try {

        if( navigator.geolocation ){

          // if watchId exists, clear It
          if(watchId){
            navigator.geolocation.clearWatch(watchId);
          }

          watchId = navigator.geolocation.watchPosition(function(position){
            
            $scope.currentCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            console.log("================>navigator.geolocation.watchPosition<================");
            console.log($scope.currentCoords);
            console.log("================>/navigator.geolocation.watchPosition<================");

            $scope.$apply();

          }, function(e){
            console.log(e);

          }, { maximumAge: 3000, timeout: 5000, enableHighAccuracy: true });
        }else{
          console.log("Cannot find navigator");
        }


      } catch (error) {
        console.log("There was an error");
        console.log(error);
      }
  
    }, false);
    

  });

  $scope.$on("$ionicView.enter", function(event, data){
    // handle event
    console.log('=============$ionicView.enter==================');
    sync();
    checkActionBtnState();
    console.log('============/$ionicView.enter==================');
    
  });

  

})

.controller('SettingsController', function($scope){})