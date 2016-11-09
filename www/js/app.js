// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('relish', ['ionic', 'ngCordova', 'LocalStorageModule'])

.constant('DOMAIN', 'http://ec2-54-152-205-200.compute-1.amazonaws.com/api/v1')
.constant('VERSION', '1.15')

.run(function($rootScope, $window, $ionicLoading, $ionicPlatform, $urlRouter, $state, ParticipantService, ActivityService) {
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
     console.log("-- $locationChangeSuccess: Checking for authentication token");
     // Halt state change from even starting
     evt.preventDefault();
     // Verify the user has a session token
     var sessionToken = ParticipantService.getToken();
     // Continue with the update and state transition if logic allows
     if(sessionToken){
       console.log("-- $locationChangeSuccess: Token found, continue");
       $urlRouter.sync();
     }else{
       console.log("-- $locationChangeSuccess: Token not found, go to register");
       $state.go('register');
     }
   });

   if( ParticipantService.getToken() ){
     ActivityService.logActivity('App Opened')
        .finally(function(){
          console.log('app opened');
        });
   }
  


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
      controller: 'SettingsController'
    })

    .state('questions', {
      url: '/questions',  
      templateUrl: 'templates/questions.html',
      controller: 'QuestionsController'
    })

    .state('prime', {
      cache: false,
      url: '/prime',
      templateUrl: 'templates/prime.html',
      controller: 'PrimeController', 
    })

    .state('coupon', {
      cache: false,
      url: '/coupon',
      templateUrl: 'templates/coupon.html',
      controller: 'CouponController' 
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

.service('StudyService', function($q, $http, localStorageService, ParticipantService, ActivityService, GeoService, DOMAIN){
  
  function loadStudies(){
    var deferred = $q.defer();
    var token = ParticipantService.getToken();

    $http({
      url: DOMAIN + '/studies',
      method: 'GET',
      headers: { 'Authorization': 'Token ' + token }
    }).then(function(r){

      var activeStudies = r.data.results.filter(function(s){
        return s.active;
      });
      deferred.resolve(activeStudies);

    }).catch(function(e){
      deferred.reject(e);
    });

    return deferred.promise;
  }


  function getCondition(){
    var deferred = $q.defer();
    
    // load up the studies
    loadStudies()
      .then(function(studies){

        var activeStudies = studies;

        //
        // determine the study of interest
        //  -- go through all the conditions in a study,
        //     once done, go to the next study
        //     once done with all studies, go back to the first one and repeat 
        // 

        function getNextItem(arr, currId){
          // helper function to get next arr item in round robin fashion
          var indx = arr.findIndex(function(obj){ return obj.id == currId; });
          if( indx > arr.length - 2 ) { return arr[0]; }
          else{ return arr[ indx + 1 ]; }
        }

        var lastStudyId = localStorageService.get('lastStudyId');
        var lastConditionId = localStorageService.get('lastConditionId');

        // get the study
        var study;
        var condition;
        if( !lastStudyId ){
        
          study = activeStudies[0];
          condition = study.conditions[0];
        
        }else{
          // check if all the conditions are met
          var lastStudy = activeStudies.find(function(obj){ return obj.id == lastStudyId; });
          var lastConditionIndx = lastStudy.conditions.findIndex(function(obj){ return obj.id == lastConditionId });

          // get the timestamp of the last time the user pulled this
          var lastTransitionTimestamp = localStorageService.get('lastTransitionTimestamp');
          if( !lastTransitionTimestamp ){ 
            lastTransitionTimestamp = new Date( );
          }else{
            lastTransitionTimestamp = new Date( lastTransitionTimestamp );
          }
          var now = new Date();
          
          // if the last time the user checked this is in the same day, dont advnace it
          if( lastTransitionTimestamp.toDateString() === now.toDateString() ){
            // next day...
            // there are still conditions in this study, so grab the next one
              study = lastStudy;
              condition = study.conditions.find(function(obj){ return obj.id == lastConditionId; });
          }else{
            // same day...
            if( lastConditionIndx == lastStudy.conditions.length - 1 ){
              // we ran out of conditions in this study, so grab the next study and its first condition
              study = getNextItem( activeStudies, lastStudyId );
              condition = study.conditions[0];  
            }else{
              // there are still conditions in this study, so grab the next one
              study = lastStudy;
              condition = getNextItem( study.conditions, lastConditionId );
            }


          }

        }

        // cache it 
        localStorageService.set('lastStudyId',  study.id );
        localStorageService.set('lastConditionId',  condition.id );
        var now = new Date();
        localStorageService.set('lastTransitionTimestamp', now.getTime() );

        // setup the geo fence for the study
        study.regions.forEach(function(region){
          GeoService.configureGeofence({
            identifier: region.description,
            notifyOnEntry: true,
            notifyOnExit: false,
            radius: 100,
            latitude: region.lat,
            longitude: region.lng
          });
        });


        deferred.resolve({
          study: study,
          condition: condition
        });


    }).catch(function(e){
      deferred.reject(e);
    });

    return deferred.promise;
  }

  return {
    loadStudies: loadStudies,
    getCondition: getCondition
  }
})

.service('GeoService', function($q, $rootScope, $window, $timeout, $ionicPlatform, $cordovaLocalNotification, ActivityService, localStorageService){
  var bg = null;
  var coords = {lat: 90, lng: 180};
  var CONST = 1.75;
  var DELAY = 1000; //ms

  var options = {
    // Application config
    debug: false,
    stopOnTerminate: false,
    startOnBoot: true,
    geofenceProximityRadius: 100
  };

  function configureBackgroundFetch() {
    var Fetcher = window.BackgroundFetch;
    // Your background-fetch handler.
    var fetchCallback = function() {
        console.log('[js] BackgroundFetch initiated');
        Fetcher.finish();
    }

    var failureCallback = function() {
        console.log('- BackgroundFetch failed');
    };

    Fetcher.configure(fetchCallback, failureCallback, {
        stopOnTerminate: false
    });
  }

  function updateGeofenceTransitionTimestamp(){
    var n = new Date();
    localStorageService.set('geofenceTransitionTimestamp', n.getTime().toString());
  }
  function getGeofenceTransitionTimestamp(){
    var t = localStorageService.get('geofenceTransitionTimestamp');
    if(t){
      return new Date( parseInt(t) );
    }else{
      return new Date(0);
    }
  }
  function updateNotificationTimestamp(){
    var n = new Date();
    localStorageService.set('notificationTimestamp', n.getTime().toString());
  }
  function getnotificationTimestamp(){
    var t = localStorageService.get('notificationTimestamp');
    if(t){
      return new Date( parseInt(t) );
    }else{
      return new Date(0);
    }
  }

  function generateNotification(){
    // SEE: https://github.com/katzer/cordova-plugin-local-notifications/pull/1107
    console.log("-- GeoService.generateNotification")
    var deferred = $q.defer();
    var now = new Date();
    
    $ionicPlatform.ready(function(){
      try {
        cordova.plugins.notification.local.schedule({
            title: "Congrats, there is a deal availible!", 
            text: "Click to redeem coupon"
        });
        updateNotificationTimestamp();  
      } catch (e) {
        console.log("-- GeoService.generateNotification: error");
        console.log(e)
      }
      

      deferred.resolve();
      
    });
    
    return deferred.promise;
  }
  

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
    
    $ionicPlatform.ready(function(){

      if($window.BackgroundFetch) {
        console.log('has fetch');
        configureBackgroundFetch();
      }  

      if($window.BackgroundGeolocation){
        bg = $window.BackgroundGeolocation;
        // configure and start the plugin
        bg.configure(options, function(state) {
          // Plugin is configured and ready to use.
          if (!state.enabled) {
            bg.start();
          }
          deferred.resolve();
        });

      }else{
        console.log("initBackgroundLocation() Plugin not found");
        deferred.reject();
      }
      
    });

    console.log("================>/initBackgroundLocation<================");
    return deferred.promise;
  }

  function getCurrentPosition(){
    var deferred = $q.defer();
    $ionicPlatform.ready(function(){
      if($window.BackgroundGeolocation){
        bg = $window.BackgroundGeolocation;

        bg.getCurrentPosition(function(location, taskId) {
            coords.lat = location.coords.latitude;
            coords.lng = location.coords.longitude;
            
            bg.finish(taskId);
            deferred.resolve();

        }, function(errorCode) {
            console.log('An location error occurred: ' + errorCode);
            deferred.reject();
        });       
      }else{
        console.log('-- Geoservice.getCurrentPosition: missing plugin')
        deferred.reject('missing plugin');
      }
    });
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
    console.log("-- Geoservice.configureGeofence()");

    $ionicPlatform.ready(function() {
      if($window.BackgroundGeolocation){
        
        bg = $window.BackgroundGeolocation;
        // set event listener
        bg.onGeofence(function(geofence, taskId) {
          try {
            var identifier = geofence.identifier;
            var action     = geofence.action;
            var location   = geofence.location;

            console.log("- A Geofence transition occurred");
            console.log("  identifier: ", identifier);
            console.log("  action: ", action);
            console.log("  location: ", JSON.stringify(location));

            console.log("=======================================");
            console.log(JSON.stringify(geofence));
            console.log("=======================================");

            updateGeofenceTransitionTimestamp();

            var lat = location.coords.latitude;
            var lng = location.coords.longitude

            try {
              ActivityService.logActivity('GeoFence Transition - ' + identifier + ' - ' + action + ' - ' + lat + ':' + lng)
                .finally(function(){

                  console.log('-- LOGGED TRANSITION');

                  // generate a notification
                  generateNotification()
                    .finally(function(){
                      
                      console.log('-- GENERATED NOTIFICATION');

                      bg.finish(taskId);    
                    });

                });  
            } catch (error) {
              console.log("ERROR");
              console.log(error);
              bg.finish(taskId);
            }

            

          } catch(e) {
            console.error("-- Geoservice.configureGeofence(): An error occurred in my code!", e);
            bg.finish(taskId);
          }

        });

        // bg.removeGeofence(options.identifier);
        bg.addGeofence({
            identifier: options.identifier,
            radius: options.radius,
            latitude: options.latitude,
            longitude: options.longitude,
            notifyOnEntry: true
        }, function() {
            console.log("-- Geoservice.configureGeofence(): Successfully added geofence");
            console.log("-- Geoservice.configureGeofence(): " + options.identifier);            
        }, function(error) {
            console.warn("-- Geoservice.configureGeofence(): Failed to add geofence", error);
            deferred.reject();
        });

        // print the geofences
        bg.getGeofences(function(geofences) {
          geofences.forEach(function(geofence){
            console.log("Geofence: ", geofence.identifier, geofence.radius, geofence.latitude, geofence.longitude);
          });
        }, function(error) {
          console.warn("Failed to fetch geofences from server");
        });

        bg.configure(options, function(state) {
          // Plugin is configured and ready to use.
          if (!state.enabled) {
            bg.start();
          }
        });

      }else{
        console.log("-- Geoservice.configureGeofence(): Cant find plugin");
      }
    });
  }

  function getGeoFences(){
    var deferred = $q.defer();
    
    $ionicPlatform.ready(function() {
        if($window.BackgroundGeolocation){
          var fences = [];      
          bg = $window.BackgroundGeolocation;
          // print the geofences
          bg.getGeofences(function(geofences) {
            
            geofences.forEach(function(geofence){
              
              console.log("Geofence: ", geofence.identifier, geofence.radius, geofence.latitude, geofence.longitude);
              fences.push(geofence);

            });

            deferred.resolve(fences);

          }, function(error) {
            console.warn("Failed to fetch geofences from server");
          });
      }else{
        console.log('cant find plugin');
        deferred.reject();
      }

    });

    return deferred.promise;
  }

  function inGeoFence(regions, radius){
    console.log('-- Geoservice.inGeoFence()');
     var deferred = $q.defer();
     
     getCurrentPosition()
      .then(function(){
        console.log('-- Geoservice.inGeoFenc(): resolved getCurrentPosition')
        var flag = false;
        regions.forEach(function(region){
          var d = getDistance(coords.lat, coords.lng, region.lat, region.lng);
          if( d <= radius * CONST){
            flag = true;
           }
        });

        deferred.resolve(flag);
      })
      .catch(function(e){
        console.log(e);
        deferred.reject(e);
      });

     return deferred.promise;
  }

  return {
    coords: coords,
    initBackgroundLocation: initBackgroundLocation,
    getCurrentPosition: getCurrentPosition,
    configureGeofence: configureGeofence,
    getDistance: getDistance,
    getGeoFences: getGeoFences,
    getGeofenceTransitionTimestamp: getGeofenceTransitionTimestamp,
    getnotificationTimestamp: getnotificationTimestamp,
    inGeoFence: inGeoFence
  }
})

.service('ActivityService', function($q, $http, ParticipantService, DOMAIN){
  
  function logActivity(text){
    var deferred = $q.defer();
    var token = ParticipantService.getToken();
    $http({
      url: DOMAIN + '/activities',
      method: 'POST',
      headers: { 'Authorization': 'Token ' + token },
      contentType: "application/json",
      data: { text: text }
    }).then(function(r){
      console.log('-- ActivityService.logActivity: logged');
      console.log(text);
      deferred.resolve();
    }).catch(function(e){
      console.log('-- ActivityService.logActivity: error')
      console.log(e)
      deferred.reject(e);
    });
    return deferred.promise;
  }

  return {
    logActivity: logActivity
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

.controller('PermissionsController', function($scope, $state, $window, $ionicPlatform, ActivityService, GeoService){
  permissionsGranted = 0;
  $scope.geoPermissionsReqVisible = true;
  $scope.pushPermissionsReqVisible = false;
  
  function requestGeoPermissions(){
    console.log('permissions')
    var allowed = false;
        
    $ionicPlatform.ready(function(){
      GeoService.initBackgroundLocation()
        .then(function(){

          ActivityService.logActivity('Granted Location Permissions')
            .finally(function(){
              console.log('hey now');
              
              permissionsGranted+=1;
    
              $scope.geoPermissionsReqVisible = false;
              $scope.pushPermissionsReqVisible = true;

            });

          
        })
        .catch(function(){
          console.log("boo");
          ActivityService.logActivity('Refused to Grant Location Permissions')
            .finally(function(){
                  
            });
        });
    });
    
  }
  $scope.requestGeoPermissions = requestGeoPermissions;

  function requestPushPermissions(){
    $ionicPlatform.ready(function(){
      if($window.cordova && $window.cordova.plugins.notification.local){
          $window.cordova.plugins.notification.local.registerPermission(function (granted) {
            console.log('Permission has been granted: ' + granted);

            if(granted){
              ActivityService.logActivity('Granted Notification Permissions')
                .finally(function(){
                  permissionsGranted += 1;
                  shouldProceed();        
                });
            }else{
              ActivityService.logActivity('Refused to Grant Notification Permissions')
                .finally(function(){
                  permissionsGranted += 1;
                  shouldProceed();        
                });
            }
            
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
      // if no questions, then skip
      if( qs.length == 0 ){ $state.go('prime'); }

      $scope.questions = qs;
      $scope.questions.forEach(function(q){ $scope.answers.push(""); });
    })
    .catch(function(error){
      console.log(error);
      // if no questions, then skip
      if( qs.length == 0 ){ $state.go('prime'); }
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

.controller('PrimeController', function($ionicPlatform, $scope, $timeout, $state, $q, StudyService, ActivityService, GeoService){
  console.log('-- PrimeController');

  var DELAY = 5000; // ms
  var RADIUS = 100; // m 
  $scope.state = 0; // 0 - out of region, 1 - in the region, 2 - too late, 3 - prime
  
  $scope.actionPrompt = "TOO FAR"; // TOO LATE, RELISH IT
  $scope.detailsTitle = "Come and visit"; // Gotta be faster, Primer Title
  $scope.detailsDescription = "You are currently too far from a participating store. We’ll notify you when you’re closer."
  // There’s a 5 minute window in which you need to claim your coupon. Try again next time!
  // Primer Description


  $scope.study;
  $scope.condition;
  $scope.disableActionPrompt = true;
  
  // monitor app states (foreground / background)
  $ionicPlatform.ready(function() {
      document.addEventListener("resume", function(){
          console.log("-- ionicPlatform: resume event");
          updateState();
      }, false);
      document.addEventListener("pause", function(){
          console.log("-- ionicPlatform: pause event");
      }, false);
  });

  function displayPrimer(){
    $scope.state = 1;
    $scope.actionPrompt = 'One Moment';
    $scope.detailsTitle = $scope.condition.description;
    $scope.detailsDescription = 'Press the "Relish It" button to claim your coupon'
    $timeout(function(){
        $scope.actionPrompt = 'RELISH IT';
        $scope.disableActionPrompt = false;
    }, DELAY);
  }


  function updateState(){
    console.log('-- PrimeController.updateState')
    // if it clears, show the prime
    syncStudies()
      .then(function(){
        // first lets see if we are inside the fence
        syncLocation()
          .then(function(inRegion){
            
            if(inRegion){
              // see if we opened the app in time
              displayPrimer();
              // the app was not opened in time
            }
            // we are not in the region - so leave it

          }).catch(function(e){
            console.log(e);
          });

      });
  }
  updateState();
  
  function syncLocation(){
    console.log('-- PrimeController.syncLocation');
    var deferred = $q.defer();
    GeoService.inGeoFence($scope.study.regions, 100)
      .then(function(inRegion){
        deferred.resolve(inRegion);
      })
      .catch(function(e){
        deferred.reject(e);
      });
    return deferred.promise;
  }

  function syncStudies(){
    console.log('-- PrimeController.syncStudies');
    var deferred = $q.defer();

    StudyService.getCondition()
      .then(function(res){
        $scope.study = res.study;
        $scope.condition = res.condition;
        deferred.resolve();
      }).catch(function(e){
        console.log(e);
        deferred.reject(e);
      });

      return deferred.promise;
  }

  function claim(){
    console.log('claim coupon');
    ActivityService.logActivity('Coupon Claim Button Pressed')
    .finally(function(){
      $state.go('coupon');                    
    });
    
  }
  $scope.claim = claim;

  ActivityService.logActivity('Prime View Entered')
    .finally(function(){
                        
    });


})

.controller('CouponController', function($scope, $state, ActivityService, StudyService){
  $scope.study;
  $scope.condition;

  StudyService.loadStudies()
    .then(function(study){
      $scope.study = study;

      StudyService.getCondition($scope.study.conditions)
        .then(function(r){
          $scope.condition = r;
          console.log($scope.condition);

        })
        .catch(function(e){
          console.log(e);
        });
      
    })
    .catch(function(e){
      console.log(e);
      alert("Failed to syncStudies study");
    });

  ActivityService.logActivity('Coupon View Entered')
    .finally(function(){
                        
    });

  function close(){
    $state.go('prime');
  }
  $scope.close = close;

})

.controller('SettingsController', function($scope, GeoService, VERSION){
  $scope.version = VERSION;
  $scope.fences = [];
  $scope.debug = false;
  $scope.lastTransition = GeoService.getGeofenceTransitionTimestamp();
  $scope.lastNotification = GeoService.getnotificationTimestamp();

  $scope.showDebug = function(){
    $scope.debug = !$scope.debug; 
  }

  GeoService.getGeoFences()
    .then(function(fences){
      $scope.fences = fences;
    })
})