var Backbone = require('exoskeleton');
Backbone.NativeView = require('backbone.nativeview');
var getJSON = require('../js/utils/getjson.js');
var Hammer = require('hammerjs');
var eventHTML = require('../html/event.html');
var modalHTML = require('../html/modal.html');
var chroma = require('chroma-js');
var Mustache = require('mustache');
Mustache.parse(eventHTML);
Mustache.parse(modalHTML);

// Analytics
var analytics = require('../js/utils/analytics.js');
analytics('create', 'UA-25353554-28', 'auto');
analytics('send', 'pageview', { 'title': 'UN in 70 years' });

var EventCollection = Backbone.Collection.extend({

	parse: function(json) {
		if ( !json || !json.hasOwnProperty('sheets') || json.hasOwnProperty('timline') ) {
			return console.warn('Unexpected JSON data', json);
		}


		return json.sheets.timeline.map(function(item) {
			item.YEAR = parseInt(item.YEAR, 10);

            if (item.IMAGES) {
                item.IMAGES = item.IMAGES.replace('"', '');
                item.IMAGES = item.IMAGES.split(',');
            }
            return item;
        });

	}
});

var svgs = require('./svgs.js');



var EventView = Backbone.NativeView.extend({

	activate: function(model) {
		var targetIndex = this.parent.eventViews.indexOf(this);

		this.parent.eventViews.forEach( function(card, index) {
			card.el.classList.remove('next');
			card.el.classList.remove('next2');
			card.el.classList.remove('active');
			card.el.classList.remove('delt');

			if (index === targetIndex - 2) {
				card.el.classList.add('next2');
			}

			if (index === targetIndex - 1) {
				card.el.classList.add('next');
			}

			if (index === targetIndex + 1 ) {
				card.el.classList.add('delt');
			}

		});

		this.el.classList.add('active');

	},

	render: function() {

		this.model.set('svg', svgs[ this.model.get('CATEGORY') ]);

		var el = document.createElement('div');
		el.innerHTML = Mustache.render(eventHTML, this.model.attributes);
		el.innerHTML = el.innerHTML.trim();
		this.el = el.firstChild;

		var categoryName = this.model.get('CATEGORY');
		if (categoryName && categoryName.trim().length < 1) {
			categoryName = 'unknown';
		}

		this.el.classList.add( categoryName );
		this.innerEl = this.el.querySelector('.gv-event-inner-wrap');
		this.overlayEl = this.el.querySelector('.gv-event-overlay');
		this.overlayShinyEl = this.el.querySelector('.gv-event-overlay-shiny');
		return this;
	}

});


var BaseView = Backbone.NativeView.extend({

	html: require('../html/base.html'),

	initialize: function() {
		this.el.classList.add('gv-70');
	},

	stopAnimation: function() {
		if ( this.animInterval ) {
			clearInterval( this.animInterval );
			this.animInterval = null;
			this.el.classList.remove('animating');
		}
	},

	pan: function(ev) {
		ev.preventDefault();
		this.stopAnimation();

		var index = Math.round( ev.deltaX / this.stepWidth );
		if ( isNaN( index ) ) { return; }

		// Reverse direction on mobile
		if (this.isMobile) {
			index *= -1;
		}

		var newIndex = this.currentIndex  + index;
		newIndex = (newIndex > 70 ) ? 70 : newIndex;
		newIndex = (newIndex < 0 ) ? 0 : newIndex;
		this.showCard( newIndex, ev.type === 'panend');

	},

	showCard: function(index, save) {

		if (index - 1 < 0) {
			this.desktopPreviousBtn.classList.add('disabled');
		} else {
			this.desktopPreviousBtn.classList.remove('disabled');
		}

		if (index + 1 >= this.collection.length) {
			this.desktopNextBtn.classList.add('disabled');
		} else {
			this.desktopNextBtn.classList.remove('disabled');
		}



		this.eventViews[ index ].activate();
		var percentage = ( index  / (this.collection.models.length - 1) ) * 100;
		this.markerEl.style.left = 'calc( ' + Math.round( percentage ) + '% - 6px)';
		this.playedEl.style.width = Math.round( percentage ) + '%';
		if (save) {
			this.currentIndex = index;
		}
	},

	navNext: function() {
		this.stopAnimation();
		if (this.currentIndex + 1 >= this.collection.length) {
			return;
		}
		this.currentIndex += 1;
		this.showCard(this.currentIndex , true );
		analytics('send', 'event', 'UI', 'click-tap', 'next-item');
	},

	navPrevious: function() {
		this.stopAnimation();
		if (this.currentIndex - 1 < 0) {
			return;
		}
		this.currentIndex -= 1;
		this.showCard(this.currentIndex , true );
		analytics('send', 'event', 'UI', 'click-tap', 'previous-item');
	},


	animate: function() {
		if (this.currentIndex + 1 >= this.collection.length) {
			return this.showCard(0 , true );
		}
		this.currentIndex += 1;
		this.showCard(this.currentIndex , true );
	},

	hideIntro: function() {
		if (this.started) { return; }
		this.introEl.classList.add('hide');
		setTimeout(function() {
			this.introEl.parentNode.removeChild(this.introEl);
		}.bind(this), 300)

		this.started = true;
		analytics('send', 'event', 'UI', 'click-tap', 'skip-intro');
	},

	render: function() {
		// Mobile regex from https://gist.github.com/dalethedeveloper/1503252
		this.isMobile = !!navigator.userAgent.match(/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/gi);
		console.log(this.isMobile);
		if(this.isMobile){
			this.el.className += " gv-isMobile"
		}

		this.started = false;
		this.el.innerHTML = this.html;
		this.markerEl = this.el.querySelector( '.gv-timeline-marker' );
		this.playedEl = this.el.querySelector( '.gv-timeline-played' );

        this.eventViews = this.collection.map(function(eventModel, i, arr) {
			var eventView = new EventView({ model: eventModel });
			eventView.parent = this;
            this.el.appendChild( eventView.render().el );
            return eventView;
		}, this);

		this.elWidth = this.el.getBoundingClientRect().width;
		this.stepWidth = this.elWidth / this.collection.length;

		if ( this.isMobile ) {
			this.stepWidth *= 10;
		}




		if ( this.isMobile ) {
			this.hammer = new Hammer(this.el, { drag_lock_to_axis: true });
		} else {
			this.hammer = new Hammer(this.el.querySelector('.gv-timeline'), { drag_lock_to_axis: true });
		}
		this.hammer.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL });
		this.hammer.on('panleft panright panend', this.pan.bind(this) );
		this.hammer.on('panstart', function() {
			this.hideIntro();
			analytics('send', 'event', 'UI', 'pan', 'panned-list');
		}.bind(this));




		this.previousBtn = this.el.querySelector('.gv-nav-previous');
		this.previousBtn.addEventListener('click', this.navPrevious.bind(this), false);

		this.desktopNextBtn = this.el.querySelector('.gv-desktop-nav-next');
		this.desktopNextBtn.addEventListener('click', this.navNext.bind(this), false);

		this.desktopPreviousBtn = this.el.querySelector('.gv-desktop-nav-previous');
		this.desktopPreviousBtn.addEventListener('click', this.navPrevious.bind(this), false);

		this.introEl = this.el.querySelector('.gv-intro');
		if ( this.isMobile ) {
			this.introEl.addEventListener('click', this.hideIntro.bind(this), false);
		} else {
			this.introEl.style.display = 'none';
		}




		// Get year from URL or default to the beginning
		var urlRegex = /year=(\d{4})/;
		var result = urlRegex.exec(location.search);

		if (result && result[1] && parseInt(result[1], 10) > 1945 && parseInt(result[1], 10) < 2016) {
			var index = 0;
			this.collection.forEach( function(event, i) {
				if (event.get('YEAR') === parseInt(result[1], 10)) {
					index = i;
				}
			});
			console.log(index);
			this.currentIndex = index;

		} else {
			this.currentIndex = 0;
		}
		this.showCard(this.currentIndex, true);
		this.nextBtn = this.el.querySelector('.gv-nav-next');
		this.nextBtn.addEventListener('click', this.navNext.bind(this), false);
	}

});

module.exports = function( el ) {
	var baseView = new BaseView({
		el: el,
		collection: new EventCollection()
	});

	var url = 'http://interactive.guim.co.uk/docsdata-test/' +
		 '1iPEGi3EQBQA3biqQsu_XizgD6A-w8uffRvQ7hbDkANA.json';


	getJSON(url, function(data) {

		baseView.collection.add( baseView.collection.parse(data) );
		 baseView.render();

	}.bind(this));

}
