/* global YT */
angular.module('youtube-embed', ['ng'])
.service ('youtubeEmbedUtils', ['$window', '$rootScope', function ($window, $rootScope) {
    var Service = {};

    // Inject YouTube's iFrame API
    (function () {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }());

    Service.ready = false;

    // Youtube callback when API is ready
    $window.onYouTubeIframeAPIReady = function () {
        $rootScope.$apply(function () {
            Service.ready = true;
        });
    };

    return Service;
    
}])
.directive('youtubeVideo', ['youtubeEmbedUtils','$ionicPlatform', function (youtubeEmbedUtils, $ionicPlatform) {
    var uniqId = 1;

    // from YT.PlayerState
    var stateNames = {
        '-1': 'unstarted',
        0: 'ended',
        1: 'playing',
        2: 'paused',
        3: 'buffering',
        5: 'queued'
    };

    var eventPrefix = 'youtube.player.';
    
    var deviceType = $ionicPlatform.is('iOS') === true ? 'iOS' : 'Android';

    return {
        restrict: 'EA',
        scope: {
            videoId: '=?',
            player: '=?',
            playerVars: '=?',
            playerHeight: '=?',
            playerWidth: '=?'
        },
        link: function (scope, element, attrs) {
            // allows us to $watch `ready`
            scope.utils = youtubeEmbedUtils;

            // player-id attr > id attr > directive-generated ID
            var playerId = attrs.playerId || element[0].id || 'unique-youtube-embed-id-' + uniqId++;
            element[0].id = playerId;

            // Attach to element
            scope.playerHeight = scope.playerHeight || 390;
            scope.playerWidth = scope.playerWidth || 640;
            scope.playerVars = scope.playerVars || {};

            // YT calls callbacks outside of digest cycle
            function applyBroadcast () {
                
                if(deviceType ==='iOS'){
                
                    var args = Array.prototype.slice.call(arguments);
                    scope.$apply(function () {
                        scope.$emit.apply(scope, args);
                    });
                }
                else{
                    window.location = "vnd.youtube:"+scope.videoId;
                }
            }

            function onPlayerStateChange (event) {
                var state = stateNames[event.data];
                if (typeof state !== 'undefined') {
                    applyBroadcast(eventPrefix + state, scope.player, event);
                }
                scope.$apply(function () {
                    scope.player.currentState = state;
                });
            }

            function onPlayerReady (event) {
                applyBroadcast(eventPrefix + 'ready', scope.player, event);
            }

            function createPlayer () {
                
                var playerVars = angular.copy(scope.playerVars);
                playerVars.start = playerVars.start || scope.urlStartTime;
                var player = new YT.Player(playerId, {
                    height: scope.playerHeight,
                    width: scope.playerWidth,
                    videoId: scope.videoId,
                    playerVars: playerVars,
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange
                    }
                });

                player.id = playerId;

                return player;
            }

            function loadPlayer () {
                if (scope.videoId || scope.playerVars.list) {
                    if (scope.player && scope.player.d &&
                        typeof scope.player.destroy === 'function') {
                        scope.player.destroy();
                    }

                    scope.player = createPlayer();
                }
            };

            var stopWatchingReady = scope.$watch(
                function () {
                    return scope.utils.ready
                        // Wait until one of them is defined...
                        && (typeof scope.videoUrl !== 'undefined'
                        ||  typeof scope.videoId !== 'undefined'
                        ||  typeof scope.playerVars.list !== 'undefined');
                },
                function (ready) {
                    if (ready) {
                        stopWatchingReady();
                        
                        scope.$watch('videoId', function () {
                            scope.urlStartTime = null;
                            loadPlayer();
                        });
                    }
            });

            scope.$watchCollection(['playerHeight', 'playerWidth'], function() {
                if (scope.player) {
                    scope.player.setSize(scope.playerWidth, scope.playerHeight);
                }
            });

            scope.$on('$destroy', function () {
                scope.player && scope.player.destroy();
            });
        }
    };
}]);
