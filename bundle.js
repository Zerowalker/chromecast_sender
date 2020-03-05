
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.19.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Slide.svelte generated by Svelte v3.19.1 */

    const file = "src\\components\\Slide.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (37:2) {#each scheme as item}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*item*/ ctx[1].name + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*item*/ ctx[1].description + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(td0, "id", "day");
    			attr_dev(td0, "class", "svelte-5ehyz2");
    			add_location(td0, file, 38, 6, 789);
    			attr_dev(td1, "class", "svelte-5ehyz2");
    			add_location(td1, file, 39, 6, 826);
    			attr_dev(tr, "class", "row svelte-5ehyz2");
    			add_location(tr, file, 37, 4, 765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(37:2) {#each scheme as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let table;
    	let each_value = /*scheme*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(table, "id", "scheme");
    			attr_dev(table, "class", "svelte-5ehyz2");
    			add_location(table, file, 35, 0, 714);
    			attr_dev(div, "id", "main");
    			attr_dev(div, "class", "svelte-5ehyz2");
    			add_location(div, file, 34, 0, 697);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*scheme*/ 1) {
    				each_value = /*scheme*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let scheme = [];
    	scheme.push({ name: "Måndag", description: "gnu" });
    	scheme.push({ name: "Tisdag", description: "gnu" });
    	scheme.push({ name: "Onsdag", description: "gnu" });
    	scheme.push({ name: "Torsdag", description: "gnu" });
    	scheme.push({ name: "Fredag", description: "gnu" });
    	$$self.$capture_state = () => ({ scheme });

    	$$self.$inject_state = $$props => {
    		if ("scheme" in $$props) $$invalidate(0, scheme = $$props.scheme);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [scheme];
    }

    class Slide extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Slide",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.19.1 */
    const file$1 = "src\\App.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let input;
    	let input_disabled_value;
    	let foo_action;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			attr_dev(input, "type", "button");
    			input.disabled = input_disabled_value = !/*initialized*/ ctx[0];
    			attr_dev(input, "id", "go-button");
    			attr_dev(input, "class", "step go svelte-1vl9leu");
    			input.value = "GO";
    			add_location(input, file$1, 154, 2, 3204);
    			attr_dev(div, "id", "main");
    			attr_dev(div, "class", "svelte-1vl9leu");
    			add_location(div, file$1, 153, 0, 3186);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			dispose = action_destroyer(foo_action = /*foo*/ ctx[1].call(null, input));
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*initialized*/ 1 && input_disabled_value !== (input_disabled_value = !/*initialized*/ ctx[0])) {
    				prop_dev(input, "disabled", input_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function receiverListener(e) {
    	if (e === "available") {
    		console.log("Chromecast was found on the network.");
    	} else {
    		console.log("There are no Chromecasts available.");
    	}
    }

    function onInitError() {
    	console.log("Initialization failed");
    }

    function onLoadSuccess() {
    	console.log("Successfully loaded image.");
    }

    function onLoadError() {
    	console.log("Failed to load image.");
    }

    function onLaunchError() {
    	console.log("No device selected?");
    }

    function onError(message) {
    	console.log(message);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	var applicationID = "E3C3DF97";
    	var namespace = "urn:x-cast:es.offd.gnu";
    	var session = null;
    	var initialized = false;

    	function initializeCastApi() {
    		if (!chrome.cast || !chrome.cast.isAvailable) {
    			window.setTimeout(initializeCastApi, 100);
    			return;
    		}

    		var sessionRequest = new chrome.cast.SessionRequest(applicationID);

    		var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
    		sessionListener,
    		function () {
    				
    			});

    		chrome.cast.initialize(apiConfig, onInitSuccess, onInitError);
    	}

    	function sessionListener(e) {
    		session = e;
    		console.log("New session");

    		if (session.media.length != 0) {
    			console.log("Found " + session.media.length + " sessions.");
    		}
    	}

    	function onInitSuccess() {
    		console.log("Initialization succeeded");
    		$$invalidate(0, initialized = true);
    	}

    	function onRequestSessionSuccess(e) {
    		console.log("Successfully created session: " + e.sessionId);
    		session = e;
    	} // session.sendMessage(namespace, message);

    	function main() {
    		initializeCastApi();
    		var go_button = document.getElementById("go-button");

    		go_button.onclick = function (e) {
    			sendMessage();
    		};
    	}

    	function sessionUpdateListener(isAlive) {
    		if (!isAlive) {
    			session = null;
    		}
    	}

    	function sendMessage(message) {
    		if (session != null) {
    			alert(1);
    		} else {
    			console.log("Requesting session..."); // session.sendMessage(namespace, message);
    			chrome.cast.requestSession(onRequestSessionSuccess, onError);
    		}
    	}

    	function foo(node) {
    		// the node has been mounted in the DOM
    		main();

    		return {
    			destroy() {
    				
    			}, // the node has been removed from the DOM
    			// the node has been removed from the DOM
    			
    		};
    	}

    	$$self.$capture_state = () => ({
    		Slide,
    		applicationID,
    		namespace,
    		session,
    		initialized,
    		initializeCastApi,
    		sessionListener,
    		receiverListener,
    		onInitSuccess,
    		onInitError,
    		onRequestSessionSuccess,
    		onLoadSuccess,
    		onLoadError,
    		onLaunchError,
    		main,
    		onError,
    		sessionUpdateListener,
    		sendMessage,
    		foo,
    		chrome,
    		window,
    		console,
    		document,
    		alert
    	});

    	$$self.$inject_state = $$props => {
    		if ("applicationID" in $$props) applicationID = $$props.applicationID;
    		if ("namespace" in $$props) namespace = $$props.namespace;
    		if ("session" in $$props) session = $$props.session;
    		if ("initialized" in $$props) $$invalidate(0, initialized = $$props.initialized);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [initialized, foo];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
