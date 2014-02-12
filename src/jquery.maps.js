/**
 * jQuery moysportMaps - Google Maps
 *
 * Copyright (c) 2014 Mikhail Kobzarev
 *
 * @version 1.1
 * @author Mikhail Kobzarev <mikhail@kobzarev.com>
 * Licensed under the MIT license
 */
;(function( $, window, document, undefined ) {

	"use strict";

	var pluginName = 'moysportMaps';

	var defaults = {
		latitude: 55.7558260, // Широта
		longitude: 37.61730, // Долгота
		zoom: 10, // Масштаб
		width: 800, // Ширина
		height: 600, // Высота
		scrollwheel: false, // Прокрутка колесом мыши
		minZoom: 3, // Минимальный zoom
		maxZoom: 26, // Максимальный zoom
		clusterStyles: [{ // Стили кластеров
			url: '/wp-content/themes/moysport/images/clusters/m1.png',
			width: 53,
			height: 52,
			textColor: '#fff',
			textSize: 11
		}, {
			url: '/wp-content/themes/moysport/images/clusters/m2.png',
			width: 56,
			height: 55,
			textColor: '#000',
			textSize: 11
		}, {
			url: '/wp-content/themes/moysport/images/clusters/m3.png',
			width: 66,
			height: 65,
			textColor: '#ffffff',
			textSize: 12
		}, {
			url: '/wp-content/themes/moysport/images/clusters/m4.png',
			width: 78,
			height: 77,
			textColor: '#ffffff',
			textSize: 12
		}, {
			url: '/wp-content/themes/moysport/images/clusters/m5.png',
			width: 90,
			height: 89,
			textColor: '#ffffff',
			textSize: 12
		}],
		mapStyles: [
			{ featureType: "administrative", elementType: "all", stylers: [ { saturation: -100 } ] },
			{ featureType: "landscape", elementType: "all", stylers: [ { saturation: -100 } ] },
			{ featureType: "poi", elementType: "all", stylers: [ { saturation: -100 } ] },
			{ featureType: "road", elementType: "all", stylers: [ { saturation: -100 } ] },
			{ featureType: "transit", elementType: "all", stylers: [ { saturation: -100 } ] },
			{ featureType: "water", elementType: "all", stylers: [ { saturation: -100 } ] }
		],
		markers: '',

		marker: {
			draggable: false,
			tpl:
				'<div class="infoBoxInner">' +
					'<div class="infoBoxThumbnail">' +
					'<a class="${link}"><img src="${thumbnail}" width="120" /></a>' +
					'</div>' +
					'<div class="infoBoxContent">' +
					'<div class="infoBoxContentTitle"><a href="${link}">${title}</a></div>' +
					'<div class="infoBoxContentAddress">${address}</div>' +
					'</div>' +
					'</div>',
			icon: '/wp-content/themes/moysport/images/ico/marker-blue.png',
			title: 'Нажмите для просмотра описания',
			id: ''
		}
	};

	var infoBox = null;
	var markerClusterer = null;
	var map = null;
	var options = null;
	var allMarkers = [];
	var currentId = 0;

	var methods = {
		/**
		 * Инициализация
		 * @param params
		 * @returns {*}
		 */
		_init:function( params ) {

			// Разрешаем цепочки вызовов
			return this.each(function(){

				var $map = $(this),
					// Идентификатор карты
					id = $map.attr('id'),
					// data-* атрибуты тега
					meta = $map.data(),
					// Защита от множественного вызова
					init = $map.data( pluginName );

				// Слепим настройки по умолчанию,
				// переданные в плагин при инициализации и
				// переданные через data-* атрибуты
				options = $.extend( {}, defaults, params, meta);

				// Если плагин ещё не проинициализирован
				if ( ! init ) {

					// Запомнить инициализацию
					$map.data( pluginName, true );

					// Когда скрипты google maps подгружены
					google.maps.event.addDomListener(window, 'load', function() {

						// Размеры карты
						$map.css({
							width: options.width + 'px',
							height: options.height + 'px'
						});

						// Стили карты
						var styledMap = new google.maps.StyledMapType( options.mapStyles, { name: "Styled Map" });

						// Создаем карту
						map = new google.maps.Map( document.getElementById( id ), {
							minZoom: options.minZoom,
							maxZoom: options.maxZoom,
							zoom: options.zoom,
							center: new google.maps.LatLng( options.latitude, options.longitude ),
							mapTypeControlOptions: {
								mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'map_style']
							},
							disableDefaultUI: true,
							scrollwheel: options.scrollwheel,
							zoomControl: true,
							zoomControlOptions   : {
								style: google.maps.ZoomControlStyle.SMALL
							}
						});

						// Впариваем наши стили карты
						map.mapTypes.set( 'map_style', styledMap );
						map.setMapTypeId( 'map_style' );

						// Создаем кастомный инфобокс
						infoBox = new InfoBox({
							closeBoxMargin: '0',
							maxWidth: 370,
							pixelOffset: new google.maps.Size(-185, -210)
						});

						// Клик по карте
						google.maps.event.addListener(map, 'click', function(event) {
							// Заркыть информационное окно
							infoBox.close();
						});

						google.maps.event.addListener(map, 'zoom_changed', function(event) {
							// Заркыть информационное окно
							infoBox.close();
						});

						// Создать контрол переключения геопозиции
						var geoWidget = $(document.createElement('DIV'));
						geoWidget.attr("id", "homeControl");
						geoWidget.html(
							'<div class="btn-group">' +
								'<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" title="Показать/Скрыть маркер своего местоположение">' +
									'<span class="glyphicon glyphicon-map-marker"></span>' +
								'</button>' +
								'<ul class="dropdown-menu" role="menu">' +
									'<li><a href="javascript:$(\'#map\').moysportMaps( \'getManualLocation\' );"><span class="glyphicon glyphicon-hand-right"></span> Вручную</a></li>' +
									'<li><a href="javascript:$(\'#map\').moysportMaps( \'getLocation\' );"><span class="glyphicon glyphicon-send"></span> Автоматически</a></li>' +
								'</ul>' +
							'</div>'
						);
						map.controls[google.maps.ControlPosition.TOP_LEFT].push(geoWidget.get(0));

						// Очистить кластер, если он вдруг есть
						if (markerClusterer) {
							markerClusterer.clearMarkers();
						}


						// Компилируем шаблон маркера
						$.template( 'marker-tpl', options.marker.tpl );

						var markers = [];

						// Если передан массив с маркерами
						if ( options.markers ) {

							var fn = window[options.markers];

							if (typeof fn === 'object') {

								var len = fn.length;

								for (var i = 0; i < len; ++i) {
									var latLng = new google.maps.LatLng(fn[i].latitude, fn[i].longitude);


									var marker = methods.createMarker.apply( this, [
										latLng, {
											data: fn[i].data
										}
									]);

									markers.push(marker);
								}
							}
						}

						// Создаем кластер и добавляем в него маркеры
						markerClusterer = new MarkerClusterer(map, markers, {
							// Отключаем кластеры, когда видны номера домов
							maxZoom: 15,
							// Размер ячейки кластера
							gridSize: 100,
							// Стильи кластеров разного размера
							styles: options.clusterStyles,
							// Текст при наведении на кластер
							title: 'Нажмите на иконку для увеличения'
						});

						//console.log(markerClusterer);

					});


					//return this.bind("click.mySimplePlugin",function(){
					//	$(this).css('color', options.color);
					//});
				}

			});

		},

		/**
		 * Получить уникальный идентификатор
		 * @returns {number}
		 */
		getUniqueId: function() {
			return ++ currentId;
		},

		/**
		 * Создание маркера
		 * @param position
		 * @param args
		 * @returns {google.maps.Marker}
		 */
		createMarker: function( position, args ) {

			var moptions = $.extend({}, options.marker, args);

			var id = moptions.id || methods.getUniqueId();

			var marker = new google.maps.Marker({
				position: position,
				//map: map,
				title: moptions.title,
				icon: moptions.icon,
				draggable: moptions.draggable,
				animation: google.maps.Animation.DROP,
				id: 'marker-' + id
			});

			allMarkers[marker.id] = marker;

			var content = $.tmpl( 'marker-tpl', args.data );

			google.maps.event.addDomListener(marker, 'click', function(){
				// Покажем infoBox
				infoBox.setContent(content.html());
				infoBox.open(map, marker);
				// Центруем карту по маркеру
				map.panTo( position );
			});

			// Удалим объект настроек
			moptions = null;

			return marker;
		},

		/**
		 * Вернуть созданную карту
		 * @returns {*}
		 */
		getMap: function() {
			return map;
		},

		/**
		 * Добавить маркер на карту
		 */
		addMarker: function( marker ) {
			marker.setMap( map );
		},

		/**
		 * Удаление маркера
		 * @param marker
		 */
		deleteMarker: function( id ) {
			if ( methods.markerExist( id ) ) {
				allMarkers['marker-' + id].setMap(null);
			}
		},

		/**
		 * Проверка существования маркера на карте
		 * @param id
		 * @returns {boolean}
		 */
		markerExist: function( id ) {
			return !!allMarkers['marker-' + id];
		},

		/**
		 * Добавить на карту маркер ручного указания позиции
		 */
		getManualLocation: function() {

			// Удалить маркер геолокации
			methods.deleteMarker( 'location' );
			// Закрыть информационное окно
			infoBox.close();

			if ( ! methods.markerExist( 'manual' ) ) {
				var location = new google.maps.LatLng($.cookie('user-latitude'), $.cookie('user-longitude') );
				var marker = methods.createMarker( location, {
					id: 'manual',
					icon: '/wp-content/themes/moysport/images/ico/marker-you.png',
					zIndex: 9999,
					draggable: true,
					title: 'Перетащите иконку в нужное вам место'
				});
				methods.addMarker( marker );

				map.panTo( location );

				google.maps.event.addDomListener( marker, 'drag', function() {
					infoBox.close();
				});
				google.maps.event.addDomListener( marker, 'dragend', function() {

					var location = marker.getPosition();

					// Центрируем карту по маркеру
					map.panTo( location );

					// Записываем координаты в куки
					$.cookie( 'user-latitude', location.lat() );
					$.cookie( 'user-longitude', location.lng() );

					// Определить адрес по координатам
					methods.geocodePosition( location, marker );
				});
			}
		},

		/**
		 * Определение адреса по координатам (геокодирование)
		 * @param position
		 */
		geocodePosition: function ( position, marker ) {

			var geocoder = new google.maps.Geocoder();

			geocoder.geocode( {
					latLng: position
			}, function(results, status) {
				if ( google.maps.GeocoderStatus.OK === status ) {
					infoBox.setContent( results[0].formatted_address );
					infoBox.open( map, marker );
				} else {
					$.error( 'Адрес не определен' );
				}
			});
		},

		/**
		 * Определение местоположения на основе HTML5 Geolocation API
		 * @param callback
		 */
		getLocation: function( callback ) {

			// Удалить маркер ручной позиции
			methods.deleteMarker( 'manual' );

			if (navigator && navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					function ( position ) {

						// Если такой маркер уже есть на карте
						if ( ! methods.markerExist( 'location' ) ) {
							var location = new google.maps.LatLng( position.coords.latitude, position.coords.longitude );

							// Создать маркер со своими координатами
							var marker = methods.createMarker.apply( this, [
								location, {
									id: 'location',
									icon: '/wp-content/themes/moysport/images/ico/geolocation.png'
								}
							]);

							methods.addMarker.apply( this, [
								marker
							]);

							map.panTo( location );

							methods.geocodePosition( location, marker );

						}

						// Вызываем callback
						//fn( location );
					},
					function ( error ) {
						var errors = {
							1: 'Нет прав доступа',
							2: 'Местоположение невозможно определить',
							3: 'Таймаут соединения',
							4: 'Неизвестная ошибка'
						};
						$.error( 'Ошибка: ' + errors[error.code] );
					}
				);
			} else {
				$.error( 'Браузер не поддерживает геолокацию' );
			}
		},

		/**
		 * Очистить кластер
		 */
		clearClusters: function( e ) {
			e.preventDefault();
			e.stopPropagation();
			markerClusterer.clearMarkers();
		},

		/**
		 * Переключение отскакивания маркера от карты
		 * @param marker
		 */
		toggleBounce: function( marker ) {
			if ( null !== marker.getAnimation() ) {
				marker.setAnimation(null);
			} else {
				marker.setAnimation(google.maps.Animation.BOUNCE);
			}
		}

	};

	$.fn[pluginName] = function( method ) {
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods._init.apply( this, arguments );
		} else {
			// если ничего не получилось
			$.error( 'Метод "' +  method + '" не найден в плагине ' + pluginName );
		}
	};
})( jQuery, window, document );