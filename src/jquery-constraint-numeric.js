/**
 * This file is part of the Scribe jQuery Numeric Plugin.
 *
 * For the full copyright and license information, view the LICENSE.md
 * file that was distributed with this source code.
 */

/*
 * Wrap our plugin implementation within a self-invoking function as to not pollute the
 * global scrope. Additionally, provide a uniform and standardized variable implementation
 * for "undefined" so we do not have to worry about or pay attention to the different
 * implementations provided by whatever engine we may be running on.
 */
(function(window, $, undefined){

	/*
	 * Implement a stateful jQuery plugin without reliance on any additional code from
	 * the UI toolkit, such as Widget.
	 */
	var Numeric = function(element, options){

		// Assign our element both as a DOM reference and jQuery object within the class instance.
		this.element  = element;
		this.$element = $(element);

		// Assign any user-supplied options and attempt to get any options defined on the element-level
		// via an optional "data-numeric-options" HTML attribute.
		this.options  = options;
		this.metadata = this.$element.data('numeric-options');

	};

	/*
	 * Define our prototype. The following approach allows for the user to call the plugin
	 * via its manual constructor or via the jQuery API, including support for chaining.
	 * Even more importantly, it can be easily extended by others who may want to add additional
	 * callbacks or other related functionality by simply extending the prototype.
	 */
	Numeric.prototype = {

		/*
		 * Here we define the default plugin object configuration, used when no user-supplied
		 * values are passed. The default is to allow for a Western/American-formatted decimal
		 * character (a period "."), impose no decimal place restrictions, as well as allow
		 * for negative numbers.
		 *
		 * An additional option has been added named "delegateRemoval" that defaults to true.
		 * Its intent (and to clarify the wording) is to say "you would like to delegate removal
		 * of invalid characters to Numeric" --- such is the current behavior. Setting it to
		 * false disables internal handling of invalid characters outside of the dispatching of
		 * event handlers to which you can listen for and define your own implementation.
		 *
		 * Lastly, you can listen for (using `on('event')`) the newly fired events, for both valid and
		 * invalid entries, or you may pass callbacks directly. Regardless, your functions will
		 * receive the same set of parameters. The events will fire whether callbacks are set or
		 * not, so you could theoretically use both if you had a use-case for it.
		 */
		defaults : {
			negative             : true,
			decimal              : true,
			decimalPlaces        : undefined,
			delegateRemoval      : true,
			delegateRealtime     : true,
			callbackInvalidEntry : undefined,
			callbackValidEntry   : undefined
		},

		/*
		 * A simple object holding two array values. Both represent the defaults for either the event
		 * message or the event type that are used when only a boolean (pass/fail) parameter is
		 * provided to the method that builds the event object.
		 */
		eventLookupTable : {
			message : [
				"An invalid character was entered within the text field.",
				"The text field contains valid characters."
			],
			eventType : [
				"scr:numeric.entry_invalid",
				"scr:numeric.entry_valid"
			]
		},

		/*
		 * Our initializer is lazy: it simply hands off configuration parsing and event binding to
		 * other functions, who then do important stuff.
		 */
		init : function() {
			this.mergeConfiguration();
			this.bindEventReceivers();

			return this;
		},

		/*
		 * We first combine any available config, in the following order: class-provided defaults,
		 * user-passed values, followed by element-specific values (accomplished by checking the
		 * element's "data-numeric-options" attribute). Then we need to interpret these values.
		 */
		mergeConfiguration : function() {

			// Combine the possible configuration object, from defaults, to user global set, to user element set
			this.config = $.extend({}, this.defaults, this.options, this.metadata);

			// If the user provided a non-boolean (invalid) value, we reset the config back to the default.
			if (typeof this.config.negative !== "boolean") {
				this.config.negative = this.defaults.negative;
			}

			// The decimal option may be a single character string or a boolean where true equals
			// a western-style decimal, or period, and false equals no decimal allowed. Again, we
			// go back to the default if an invalid value is provided.
			if ((this.config.decimal === false) || (typeof this.config.decimal === "string" && this.config.decimal.length !== 1))
				{ this.config.decimal = this.defaults.decimal; }

			// At this point, the assumption is if it isn't a string, they passed true, so the default
			// decimal character used in the Western world is selected automaticly.
			if (typeof this.config.decimal !== "string") {
				this.config.decimal = ".";
			}

			// This config value resolves as follows: 1. If true or undefined, there is no restricition on the
			// length of digits following a decimal point. 2. If an integer, the number of decimal places
			// cannot exceed it. 3. Lastly, if false or zero, no decimal places can exist.
			this.config.decimalPlaces = (this.config.decimalPlaces !== this.defaults.decimalPlaces &&
				+this.config.decimalPlaces !== parseInt(this.config.decimalPlaces, 10) ?
				this.defaults.decimalPlaces : +this.config.decimalPlaces);

			// If the user provided a non-boolean (invalid) value, we reset the config back to the default.
			if (typeof this.config.delegateRemoval !== "boolean") {
				this.config.delegateRemoval = this.defaults.delegateRemoval;
			}

			// If the user provided a non-boolean (invalid) value, we reset the config back to the default.
			if (typeof this.config.delegateRealtime !== "boolean") {
				this.config.delegateRealtime = this.defaults.delegateRealtime;
			}

			// If the user provided a non-function (invalid) value, we set the callback to undefined.
			if (typeof this.config.callbackInvalidEntry !== "function") {
				this.config.callbackInvalidEntry = undefined;
			}

			// If the user provided a non-function (invalid) value, we set the callback to undefined.
			if (typeof this.config.callbackValidEntry !== "function") {
				this.config.callbackValidEntry = undefined;
			}

		},

		/*
		 * Quite simle function to handle binding the relevant events to the respective listeners for
		 * whatever element was provided. This function determines whether the validity checks are handled
		 * in real-time or now.
		 */
		bindEventReceivers : function() {

			// Store the initial value of the input/textbox by triggering a shared function that is used
			// as the first call, and oportunity to bail immediatly, by all event listeners, as they have
			// no reason to waste CPU resources if the value has not changed!
			this.hasElementValueChanged();

			// Bind to the change and blur events initially. These are both not called "live" --- meaning
			// no validation does not occur until the user has finished entering data.
			this.$element.on('change blur', $.proxy(this.validateLazy, this));

			// If the user does not want real-time updates, perform an early return without binding
			// additional events.
			if (this.config.delegateRealtime === false) { return this; }

			// Bind our handlers to the "live" events, making sure they retain object scope: details of the
			// event are still passed as the first parameter to the method as it normally would be, but "this"
			// does *not* refer to the element (as it generally would), but instead to this class instance.
			this.$element.on('keydown keypress keyup', $.proxy(this.validateLive, this));

			// Returns itself...
			return this;

		},

		/*
		 * Every time this function is called, it checks the current value of the element against the last
		 * value. If they are equivalent, this function returns false; if they are different, it returns
		 * true. Every event callback function utalizes this function as its first call to allow it perform
		 * a quick return, as there is no need for the same value to be validated more than once. As most of
		 * the events required for live validation can be triggered when nothing has changed, this quick
		 * check helps conserve valuable CPU resources and creates an overall speedier, more optomized
		 * validation routine.
		 */
		hasElementValueChanged : function() {

			// First, make sure this function has been called before, otherwise, set the object variable to
			// whatever the current value is and return true, as we do not know if the value has changed.
			if (this.elementLastValue === undefined) {
				this.elementLastValue = this.$element.val();
				return true;
			}

			// Check the last known value against the current value and return false if unchanged.
			if (this.elementLastValue === this.$element.val()) { return false; }

			// Update the last know value to the current elemement value.
			this.elementLastValue = this.$element.val();

			// Notify the calling function the value has changed.
			return true;

		},

		/*
		 * Function exposed to the user to perform arbitrary validation calls. This method cannot be called
		 * until they have either initialized the object manually or done so through the jQuery API. For
		 * example, this method will do nothing unless the following has previously occured:
		 *
		 * --- optionally set their own defaults:
		 * Numeric.defaults = {};
		 *
		 * --- then run either:
		 * var hourInputValidator = $('input.timeHour').numeric({});
		 *
		 * --- or:
		 * var hourInputValidator = Numeric.init('input.timeHour');
		 *
		 * --- at which point the following works as expected:
		 * hourInputValidator.validate();
		 *
		 * If that the above is called by itself, it will simply return undefined.
		 */
		validate : function() {

			// Perform a quick return if the object instance wasn't previously initialized.
			if (this.element === undefined) { return this; }

			// Perform a quick return if the element hasn't changed since its last check.
			if (this.hasElementValueChanged === false) { return this; }

			// Call the live validation routine, followed by the lazy validation routine. The live method
			// should expect the same level of granularity as previous (per character, generally), whereas
			// the laxy method should expect to perform a final quality control check against the entire
			// value per the configuration set.
			this.validateLive().validateLazy();

			// All done here, folks.
			return this;

		},

		/*
		 * Perform the live-input validation routines. This method may be split into multiple methods as was
		 * the case prior, but it needs to be re-worked, as there was too much duplication of effort prior and
		 * parallel events firing for it to remain a feasable solution on a high-traffic website with a large
		 * amount of form that need this numeric validation.
		 */
		validateLive : function(e) {

			// Perform a quick return if the element hasn't changed since its last check.
			if (this.hasElementValueChanged === false) { return this; }

			/***
			 *** PERFORM VALIDATION
			 *** While we have access to the element via the passed event object, we already have the element
			 *** itself right at this.$element, so the event object will likely only be used if we need to
			 *** perform specific checks based on *which* event triggered the function call (key[up|down], etc)...
			 ***/

			// After processing the event/input, pass a boolean of true or false, as well as an optional
			// message and simply return the functions return (which will be the same boolean passed into
			// it unless a user callback decides to stop/start propogation of an event and returns am inverse
			// value. This method centralizes the event trigger and callback logic.
			//
			// This is an example of an invalid validation cycle, with an optional string description provided:
			return this.validationResult(false, "Character % not allowed.");

		},

		/**
		 * Perform the laxy (or, more correctly: final) validation. This will occur at the end of the
		 * entry, when the textbox/input loses focus, as well as when thre user calls the public validate
		 * method manually.
		 */
		validateLazy : function(e) {

			// Perform a quick return if the element hasn't changed since its last check.
			if (this.hasElementValueChanged === false) { return this; }

			/***
			 *** PERFORM VALIDATION
			 *** While we have access to the element via the passed event object, we already have the element
			 *** itself right at this.$element, so the event object will likely only be used if we need to
			 *** perform specific checks based on *which* event triggered the function call (key[up|down], etc)...
			 ***/

			// After processing the event/input, pass a boolean of true or false, as well as an optional
			// message and simply return the functions return (which will be the same boolean passed into
			// it unless a user callback decides to stop/start propogation of an event and returns am inverse
			// value. This method centralizes the event trigger and callback logic.
			//
			// This is an example of a successful validation cycle:
			return this.validationResult(true);

		},

		/**
		 * Triggers the user-defined callbacks (if any) as well as dispatch of the custom events, which
		 * will be triggered against the element itself (and bubble up to the document-level if not
		 * listened for on an element-specific level). This method accepts a third parameter which it
		 * will append to the event ID namespace. This can optionally be supplied for more specific
		 * events, if needed, and because of the way jQuery's event system works, does not affect prior
		 * listeners. For example:
		 *
		 * --- If the user was listening for validation errors with the following code:
		 * $('form').on('numeric.error', function(e) {});
		 *
		 * --- And we decided to throw a call this method as such:
		 * this.validationResult(false, "Engine/JS CPU Profiler Warning: Browser may lock up.", "engine_resource_limit");
		 *
		 * --- This would result in the following event being thrown:
		 * "numeric.error.engine_resource_limit"
		 *
		 * --- But b/c of how jQuery handles events (by namespacing them via the periods), the first listener would
		 * --- still catch the event, as would a specific one. Specifically, if the following listeners were all
		 * --- defined by the user, all of them would get the event "numeric.error.engine_resource_limit":
		 * $('form').on('numeric'                              function(e) {));
		 * $('form').on('numeric.error',                       function(e) {});
		 * $('form').on('numeric.error.engine_resource_limit', function(e) {});
		 * $('form').on('numeric.engine_resource_limit',       function(e) {});
		 *
		 * It is then up to the user to inspect the event object and device what to do with it. At this time, we
		 * should stick to simple events (and most definetly not introduce profiler code, as this example used).
		 */
		validationResult : function(resultStatus, customMessage, typeContext) {

			// Offload the build logic associated with creating our event object.
			var e = this.buildEvent(resultStatus, customMessage, typeContext);

			// Trigger our custom event within jQuery. The event will originate from the coorosponding DOM
			// element (though it will bubble up through the DOM until it reaches the document, so you do not
			// have to listen for it explicitly on the triggering element). The first parameter your listen
			// will be given contains the event, which has all the information you need to act based on it.
			this.$element.trigger(e);

			// Finally, if any callback anonymous functions were provided as configuration values, we call
			// the appropriate one (either the invalid or valid callback) and pass the same, singular event
			// object passed to the any listeners via the above trigger function call. If callbacks exist,
			// their return value is used as the official return value. Additionally, they are proxied to
			// this object context, so "this" refers to the Numeric object inside your callbacks.
			return (result === true ?
				$.proxy(this.config.callbackValidEntry, this, e) :
				$.proxy(this.config.callbackInvalidEntry, this, e));

		},

		/**
		 * This method handles carrying out any logic required to build the event object, including the type
		 * of event it should dispatch, as well as any additional properties it may be able to attach to the
		 * event. The only required parameter is the first parameter, which must be a boolean or integer
		 * indicating the status of the prior validation actions: pass [1|true] or fail [0/false]. Default
		 * message text is defined, but there may be situations where a custom message is provided. At this
		 * time, typeContext will not be used, but it could be set to a string that is post-fixed to the
		 * event type, providing an additional level of control as to the events that are sent out.
		 */
		buildEventObject : function(resultStatus, customMessage, typeContext) {

			// Define the temporary, local variables needed to compile the different attributes to
			// be assigned to the event object. The only required function param is resultStatus (as
			// a boolean) after which the best arrangement of information is compiled.
			var e;
			var eventReturnCode;
			var eventMessage;
			var eventType;
			var eventContext;

			// Cast the boolean result status variable to an integer return value, which should be
			// thought of like a *nix exit code, where 0 = failure and 1 = success.
			eventReturnCode = (+resultStatus);

			// If a custom message is provided, that takes presedence. Otherwise, a generic message is
			// looked up within a hard-coded object using the return code to find the right index within
			// the string array. A worst-case fall-back is also hard coded in the variable assignment.
			eventMessage = (message || this.resultEventInfoLookup.message[eventReturnCode] || "Unknown event type.");

			// Just like the message string, the event type is referenced via the same lookup object defined
			// within this class. Similarly, a worst-case fall-back is hard coded in the variable assignment.
			// If a custom context is provided as a function parameter, that value is added to the end of the
			// event type. Generally this will not be the case, and instead the string "standard" will be
			// added, per the hard-coded variable assignment fallback below.
			eventType    = (this.resultInfoLookup.eventType[eventReturnCode] || "scr:numeric.entry_validity_unknown");
			eventContext = (typeContext || "standard");

			// Now we can create our fake DOM event! This is done quite simply with jQuery. In addition to the
			// event type, additional information is appended onto the event object under the "info" property,
			// which itself is another array containing the message, type, context, as well as a reference to
			// the specific element causing the validation error as well as this class instance itself.
 			e      = new $.Event(eventType + "." + eventContext);
			e.info = {
				caller  : this,
				code    : eventReturnCode,
				message : eventMessage,
				type    : {
					name     : eventType,
					context  : eventContext
				},
				element : {
					value    : this.elementLastValue,
					ref      : this.element,
					resolved : this.$element
				}
			};

			// Everything is setup and ready to be dispatched, so the event is returned.
			return e;

		}
	};

	/**
	 * Expose the ability for users to directly edit the prototype default values, allowing them
	 * to set their own global defaults prior to initializing the plugin.
	 */
	Numeric.defaults = Numeric.prototype.defaults;

	/**
	 * Expose the ability to directly call the validate method. Such may be appropriate for them
	 * to do prior to allowing a form submit to propogate, or for whatever purpose they may have.
	 * Do note, that if this is called prior to initializing an instance of the object, it *will*
	 * absolutely, break.
	 */
	Numeric.validate = Numeric.prototype.validate;

	/**
	 * Next, we expose the Numeric class defined in this scope (which includes only the ability to
	 * set your own defaults, initialize it, and call validate) globally under the singular global
	 * variable: no global-scope pollution! ;-)
	 */
	window.Numeric = Numeric;

	/**
	* Lastly, we bind to the regular jQuery API to allow for calling the plugin via a native
	* jQuery expression such as "$('form input').numeric()".
	*/
	$.fn.numeric = function(options) {
		return this.each(function() {
			new Numeric(this, options).init();
		});
	};

})(window, jQuery);

/* EOF */
