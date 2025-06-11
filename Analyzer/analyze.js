/*
Copyright 2014 Spotify AB

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var EMPTY_STACK = "	<empty stack>";
var generatedIdCounter = 1;

var specialThreadsAndStacks = []; // Global variable to store specialThreadsAndStacks

// This method is called from HTML
function analyzeTextfield() {

    // Get the special class name from the input field
    var specialClass = document.getElementById('specialClass').value;

    // Get selected thread states from the multi-select dropdown
    var threadStates = Array.from(document.getElementById('threadStates').selectedOptions).map(option => option.value);
    console.log(threadStates);
    var text = document.getElementById("TEXTAREA").value;
    analyze(text, specialClass, threadStates);
}

// This method is called from HTML so we need to tell ESLint it's not unused
function analyzeFile() { // eslint-disable-line no-unused-vars

    // Get the special class name from the input field
    var specialClass = document.getElementById('specialClass').value;

    // Get selected thread states from the multi-select dropdown
    var threadStates = Array.from(document.getElementById('threadStates').selectedOptions).map(option => option.value);
    console.log(threadStates);


    console.log(specialClass, threadStates);

    var fileNode = document.getElementById("FILE");
    if (fileNode.files.length > 0) {
        var file = fileNode.files[0];
        var fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.onloadend = function(){
            var text = fileReader.result;
            analyze(text, specialClass, threadStates);
        };
    }
}

// Define showDetails function independently
function showDetails(element) {
    var type = element.getAttribute('data-type');
    var index = parseInt(element.getAttribute('data-index'), 10);

    var details = '';
    if (type === 'threads') {
        details = specialThreadsAndStacks[index].threads.map(function(thread) {
            return thread.toHeaderHtml();
        }).join("<br>");
    } else if (type === 'stack') {
        details = specialThreadsAndStacks[index].stackFrames.join("<br>");
    }

    var newWindow = window.open("", "_blank");
    newWindow.document.write('<html><head><title>Details</title></head><body>');
    newWindow.document.write('<pre>' + details + '</pre>');
    newWindow.document.close();
}

function analyze(text, specialClass, threadStates) {
    var analyzer = new Analyzer(text, specialClass, threadStates);
    var highCpuThreads = analyzer.getHighCpuThreads(); 
    var highCpuThreadsHtml = analyzer.toHighCpuThreadsHtml(highCpuThreads);
    var highCpuTableElement = document.getElementById("HIGH_CPU_THREADS_TABLE");
    if (highCpuTableElement) {
        highCpuTableElement.innerHTML = highCpuThreadsHtml;
    }

    var highCpuDiv = document.getElementById("HIGH_CPU_THREADS_DIV");
    if (highCpuDiv) {
        highCpuDiv.style.display = (highCpuThreadsHtml && highCpuThreadsHtml.length > 0) ? "block" : "none";
    }
    
    setHtml("OUTPUT", analyzer.toHtml());

    var ignores = analyzer.toIgnoresHtml();
    setHtml("IGNORED", ignores);
    
    var synchronizers = analyzer.toSynchronizersHtml();
    setHtml("SYNCHRONIZERS", synchronizers);


    var highCpuThreads = analyzer.getHighCpuThreads(); 
}

// This method is called from HTML so we need to tell ESLint it's not unused
function clearTextfield() { // eslint-disable-line no-unused-vars
    var textArea = document.getElementById("TEXTAREA");
    textArea.value = "";

    // Clear the analysis as well
    analyzeTextfield();
}

function htmlEscape(unescaped) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(unescaped));
    var escaped = div.innerHTML;
    return escaped;
}

function stringToId(string) {
    return encodeURIComponent(string).replace("'", "%27");
}

function setHtml(name, html) {
    var destination = document.getElementById(name);
    if (!destination) {
        console.error(`setHtml: Content placeholder element with ID '${name}' not found.`);
        // Attempt to hide the associated _DIV if it exists, even if content placeholder is missing
        var divMissingContent = document.getElementById(name + "_DIV");
        if (divMissingContent) {
            divMissingContent.style.display = "none";
        }
        return;
    }
    destination.innerHTML = html;

    var div = document.getElementById(name + "_DIV");
    if (div) {
        div.style.display = (html && html.length > 0) ? "block" : "none"; // Changed to "block"
    } else {
        // This console.warn can be helpful during development
        // console.warn(`setHtml: Container element with ID '${name}_DIV' not found. Visibility not set for ${name}`);
    }
}

// Extracts a substring from a string.
//
// Returns an object with two properties:
// value = the first group of the extracted object
// shorterString = the string with the full contents of the regex removed
function _extract(regex, string) {
    var match = regex.exec(string);
    if (match === null) {
        return {value: undefined, shorterString: string};
    }

    return {value: match[1], shorterString: string.replace(regex, "")};
}

function decorateStackFrames(stackFrames) {
    if (stackFrames.length === 0) {
        return [ EMPTY_STACK ];
    }

    var decorated = [];
    for (var i = 0; i < stackFrames.length; i++) {
        decorated.push("	at " + stackFrames[i]);
    }
    return decorated;
}

function toSynchronizerHref(id) {
    return '<a href="#synchronizer-' + id + '" class="internal">' + id + "</a>";
}

function ThreadStatus(thread) {
    this.isRunning = function() {
        return this.thread.frames.length > 0 &&
            this.thread.threadState === "RUNNABLE";
    };

    this.toHtml = function() {
        var html = "";

        if (this.thread.wantNotificationOn !== null) {
            html += "awaiting notification on [";
            html += toSynchronizerHref(this.thread.wantNotificationOn);
            html += "]";
        } else if (this.thread.wantToAcquire !== null) {
            html += "waiting to acquire [";
            html += toSynchronizerHref(this.thread.wantToAcquire);
            html += "]";
        } else if (this.thread.threadState === "TIMED_WAITING (sleeping)") {
            html += "sleeping";
        } else if (this.thread.threadState === "NEW") {
            html += "not started";
        } else if (this.thread.threadState === "TERMINATED") {
            html += "terminated";
        } else if (this.thread.threadState === null) {
            html += "non-Java thread";
        } else if (this.thread.frames.length === 0 ) {
            html += "non-Java thread";
        } else if (this.thread.threadState === "RUNNABLE") {
            html += "running";
        } else {
            // FIXME: Write something in the warnings section (that
            // doesn't exist yet)
            html += '<span class="warn" title="Thread is &quot;';
            html += this.thread.threadState;
            html += '&quot; without waiting for anything">inconsistent<sup>?</sup></span>';
        }

        if (this.thread.locksHeld.length > 0) {
            html += ", holding [";
            for (var i = 0; i < this.thread.locksHeld.length; i++) {
                if (i > 0) {
                    html += ", ";
                }

                html += toSynchronizerHref(this.thread.locksHeld[i]);
            }
            html += "]";
        }

        return html;
    };

    this.thread = thread;
}

function arrayAddUnique(array, toAdd) {
    if (array.indexOf(toAdd) === -1) {
        array.push(toAdd);
    }
}

function Thread(line) {
    this.toString = function() {
        return '"' + this.name + '": ' + this.state + "\n" + this.toStackString();
    };

    this.isValid = function() {
        return Object.prototype.hasOwnProperty.call(this,"name") && this.name !== undefined;
    };

    //console.log(thread);
    // For filtering the stack frames based on a specific class!
    this.containsSpecialClass = function(specialClasses) {
        //console.log(this.name);
        for (var i = 0; i < this.frames.length; i++) {
            if(this.frames[i].includes(specialClasses))
                return true;
            // for (var j = 0; j < specialClasses.length; j++) {
            //     if (this.frames[i].includes(specialClasses[j])) {
            //         return true;
            //     }
            // }
        }
        return false;
    };

    // Return true if the line was understood, false otherwise
    this.addStackLine = function(line) {
        var match;

        var FRAME = /^\s+at (.*)/;
        match = line.match(FRAME);
        if (match !== null) {
            this.frames.push(match[1]);
            return true;
        }

        var THREAD_STATE = /^\s*java.lang.Thread.State: (.*)/;
        match = line.match(THREAD_STATE);
        if (match !== null) {
            this.threadState = match[1];
            return true;
        }

        var SYNCHRONIZATION_STATUS = /^\s+- (.*?) +<([x0-9a-f]+)> \(a (.*)\)/;
        match = line.match(SYNCHRONIZATION_STATUS);
        if (match !== null) {
            var state = match[1];
            var id = match[2];
            var className = match[3];
            this.synchronizerClasses[id] = className;

            switch (state) {
            case "eliminated":
                // JVM internal optimization, not sure why it's in the
                // thread dump at all
                return true;

            case "waiting on":
                this.wantNotificationOn = id;
                return true;

            case "parking to wait for":
                this.wantNotificationOn = id;
                return true;

            case "waiting to lock":
                this.wantToAcquire = id;
                return true;

            case "locked":
                if (this.wantNotificationOn === id) {
                    // Lock is released while waiting for the notification
                    return true;
                }
                // Threads can take the same lock in different frames,
                // but we just want a mapping between threads and
                // locks so we must not list any lock more than once.
                arrayAddUnique(this.locksHeld, id);
                arrayAddUnique(this.classicalLocksHeld, id);
                return true;

            default:
                return false;
            }
        }

        var HELD_LOCK = /^\s+- <([x0-9a-f]+)> \(a (.*)\)/;
        match = line.match(HELD_LOCK);
        if (match !== null) {
            var lockId = match[1];
            var lockClassName = match[2];
            this.synchronizerClasses[lockId] = lockClassName;
            // Threads can take the same lock in different frames, but
            // we just want a mapping between threads and locks so we
            // must not list any lock more than once.
            arrayAddUnique(this.locksHeld, lockId);
            return true;
        }

        var LOCKED_OWNABLE_SYNCHRONIZERS = /^\s+Locked ownable synchronizers:/;
        match = line.match(LOCKED_OWNABLE_SYNCHRONIZERS);
        if (match !== null) {
            // Ignore these lines
            return true;
        }

        var NONE_HELD = /^\s+- None/;
        match = line.match(NONE_HELD);
        if (match !== null) {
            // Ignore these lines
            return true;
        }

        return false;
    };

    this.toStackString = function() {
        return decorateStackFrames(this.frames).join("\n");
    };

    this.toHeaderHtml = function() {
        var headerHTML = '<span class="raw">';
        if (this.group !== undefined) {
            headerHTML += '"' + htmlEscape(this.group) + '"/';
        }

        headerHTML += '"';
        headerHTML += htmlEscape(this.name);

        headerHTML += '": ';
        headerHTML += this.getStatus().toHtml();

        headerHTML += "</span>";
        return headerHTML;
    };

    // Get the name of this thread wrapped in an <a href=>
    this.getLinkedName = function() {
        return '<a class="internal" href="#thread-' + this.tid + '">' + htmlEscape(this.name) + "</a>";
    };

    this.getStatus = function() {
        return new ThreadStatus(this);
    };

    this.setWantNotificationOn = function(lockId) {
        this.wantNotificationOn = lockId;

        var lockIndex = this.locksHeld.indexOf(lockId);
        if (lockIndex >= 0) {
            this.locksHeld.splice(lockIndex, 1);
        }

        var classicalLockIndex = this.classicalLocksHeld.indexOf(lockId);
        if (classicalLockIndex >= 0) {
            this.classicalLocksHeld.splice(classicalLockIndex, 1);
        }
    };

    var match;
    match = _extract(/\[([0-9a-fx,]+)\]$/, line);
    this.dontKnow = match.value;
    line = match.shorterString;

    match = _extract(/ nid=([0-9a-fx,]+)/, line);
    this.nid = match.value;
    line = match.shorterString;

    match = _extract(/ tid=([0-9a-fx,]+)/, line);
    this.tid = match.value;
    line = match.shorterString;

    if(this.tid === undefined){
        match = _extract(/ - Thread t@([0-9a-fx]+)/,line);
        this.tid = match.value;
        line = match.shorterString;
    }

    match = _extract(/ prio=([0-9]+)/, line);
    this.prio = match.value;
    line = match.shorterString;

    match = _extract(/ os_prio=([0-9a-fx,]+)/, line);
    this.osPrio = match.value;
    line = match.shorterString;
    
    var originalLineForCpuCheck = line; 
    match = _extract(/ cpu=([0-9]+\.?[0-9]*)ms?/, line); 
    this.cpuTime = match.value ? parseFloat(match.value) : 0; 
    line = match.shorterString;

    match = _extract(/ (daemon)/, line);
    this.daemon = (match.value !== undefined);
    line = match.shorterString;

    match = _extract(/ #([0-9]+)/, line);
    this.number = match.value;
    line = match.shorterString;

    match = _extract(/ group="(.*)"/, line);
    this.group = match.value;
    line = match.shorterString;

    match = _extract(/^"(.*)" /, line);
    this.name = match.value;
    line = match.shorterString;

    if (this.name === undefined) {
        match = _extract(/^"(.*)":?$/, line);
        this.name = match.value;
        line = match.shorterString;
    }

    this.state = line.trim();

    if (this.name === undefined) {
        return undefined;
    }
    if (this.tid === undefined) {
      this.tid = "generated-id-" + generatedIdCounter;
      generatedIdCounter++;
    }

    this.frames = [];
    this.wantNotificationOn = null;
    this.wantToAcquire = null;
    this.locksHeld = [];
    this.synchronizerClasses = {};
    this.threadState = null;

    // Only synchronized(){} style locks
    this.classicalLocksHeld = [];
}

function StringCounter() {
    this.addString = function(string, source) {
        if (!Object.prototype.hasOwnProperty.call(this._stringsToCounts, string)) {
            this._stringsToCounts[string] = {count: 0, sources: []};
        }
        this._stringsToCounts[string].count++;
        this._stringsToCounts[string].sources.push(source);
        this.length++;
    };

    this.hasString = function(string) {
        return Object.prototype.hasOwnProperty.call(this._stringsToCounts, string);
    };

    // Returns all individual string and their counts as
    // {count:5, string:"foo", sources: [...]} hashes.
    this.getStrings = function() {
        var returnMe = [];

        for (var string in this._stringsToCounts) {
            if (!Object.prototype.hasOwnProperty.call(this._stringsToCounts, string)) {
                continue;
            }

            var count = this._stringsToCounts[string].count;
            var sources = this._stringsToCounts[string].sources;
            returnMe.push({count:count, string:string, sources:sources});
        }

        returnMe.sort(function(a, b) {
            if (a.count === b.count) {
                return a.string < b.string ? -1 : 1;
            }

            return b.count - a.count;
        });

        return returnMe;
    };

    this.toString = function() {
        var string = "";
        var countedStrings = this.getStrings();
        for (var i = 0; i < countedStrings.length; i++) {
            if (string.length > 0) {
                string += "\n";
            }
            string += countedStrings[i].count +
                " " + countedStrings[i].string;
        }
        return string;
    };

    this.toHtml = function() {
        var html = "";
        var countedStrings = this.getStrings();
        for (var i = 0; i < countedStrings.length; i++) {
            html += '<tr><td class="right-align">' +
                countedStrings[i].count +
                '</td><td class="raw">' +
                htmlEscape(countedStrings[i].string) +
                "</td></tr>\n";
        }
        return html;
    };

    this._stringsToCounts = {};
    this.length = 0;
}

function createLockUsersHtml(title, threads) {
    if (threads.length === 0) {
        return "";
    }

    var html = "";
    var fullHtml = "";

    html += '<div class="synchronizer">';
    fullHtml += '<div class="synchronizer">';
    if (threads.length > 4) {
        html += threads.length + " ";
        title = title.charAt(0).toLowerCase() + title.slice(1);
    }
    html += title + ":";
    fullHtml += title + ":";
    threads.sort();
    for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];
        fullHtml += '<br><span class="raw">  ' + thread.getLinkedName() + "</span>";
        if (i < 3) {
            html += '<br><span class="raw">  ' + thread.getLinkedName() + "</span>";
        }
    }
    if (threads.length > 3) {
        html += '<br><span class="raw">  and ' + (threads.length - 3) + ' more...</span>';
    }
    html += "</div>";
    fullHtml += "</div>";

    return '<div class="synchronizer-cell" data-full-content="' + encodeURIComponent(fullHtml) + '" onclick="openThreadDetails(this)">' + html + '</div>';
}

function openThreadDetails(element) {
    var newWindow = window.open("", "_blank");
    newWindow.document.write(decodeURIComponent(element.dataset.fullContent));
}


function Synchronizer(id, className) {
    this.getPrettyClassName = function() {
        if (this._className === undefined) {
            return undefined;
        }

        var CLASS_FOR = /^java.lang.Class for .*\.([^.]*)$/;
        var match = this._className.match(CLASS_FOR);
        if (match !== null) {
            return match[1] + ".class";
        }

        var PACKAGE = /^.*\.([^.]*)$/;
        match = this._className.match(PACKAGE);
        if (match !== null) {
            return match[1];
        }

        return this._className;
    };

    /* How many threads are involved with this synchronizer? Used as a
     * sort key in the Synchronizers section. */
    this.getThreadCount = function() {
        var count = 0;
        if (this.lockHolder !== null) {
            count += 1;
        }
        count += this.lockWaiters.length;
        count += this.notificationWaiters.length;
        return count;
    };

    this.toHtmlTableRow = function() {
        var html = "";
        html += '<tr id="synchronizer-' + this._id + '">';

        html += '<td class="synchronizer">';
        html += '<div class="synchronizer">';
        html += this._id + "<br>" + this.getPrettyClassName();
        html += "</div>";
        html += "</td>";

        // Start of lock info
        html += '<td class="synchronizer">';

        if (this.lockHolder !== null) {
            html += '<div class="synchronizer">';
            html += 'Held by:<br><span class="raw">  ' + this.lockHolder.getLinkedName() + "</span>";
            html += "</div>";
        }

        html += createLockUsersHtml("Threads waiting to take lock", this.lockWaiters);

        html += createLockUsersHtml("Threads waiting for notification on lock", this.notificationWaiters);

        // End of lock info
        html += "</td>";

        html += "</tr>";
        return html;
    };

    this._id = id;
    this._className = className;

    this.notificationWaiters = [];
    this.lockWaiters = [];
    this.lockHolder = null;
}

function synchronizerComparator(a, b) {
    var countDiff = b.getThreadCount() - a.getThreadCount();
    if (countDiff !== 0) {
        return countDiff;
    }

    var prettyA = a.getPrettyClassName();
    var prettyB = b.getPrettyClassName();
    if (prettyA !== prettyB) {
        return prettyA.localeCompare(prettyB);
    }

    return a._id.localeCompare(b._id);
}

// Create an analyzer object
function Analyzer(text, specialClasses, threadStates) {
    this._handleLine = function(line) {
        var thread = new Thread(line);
        var parsed = false;
        if (thread.isValid()) {
            this.threads.push(thread);
            this._currentThread = thread;
            parsed = true;
        } else if (/^\s*$/.exec(line)) {
            // We ignore empty lines, and lines containing only whitespace
            parsed = true;
        } else if (this._currentThread !== null) {
            parsed = this._currentThread.addStackLine(line);
        }

        if (!parsed) {
            this._ignores.addString(line);
        }
        console.log("parsed");
    };

    /* Some threads are waiting for notification, but the thread dump
     * doesn't say on which object. This function guesses in the
     * simple case where those threads are holding only a single lock.
     */
    this._identifyWaitedForSynchronizers = function() {
        for (var i = 0; i < this.threads.length; i++) {
            var thread = this.threads[i];

            if (-1 === ["TIMED_WAITING (on object monitor)",
                        "WAITING (on object monitor)"].indexOf(thread.threadState))
            {
                // Not waiting for notification
                continue;
            }

            if (thread.wantNotificationOn !== null) {
                continue;
            }

            if (thread.classicalLocksHeld.length !== 1) {
                continue;
            }

            thread.setWantNotificationOn(thread.classicalLocksHeld[0]);
        }
    };

    this._isIncompleteThreadHeader = function(line) {
      if (line.charAt(0) !== '"') {
        // Thread headers start with ", this is not it
        return false;
      }
      if (line.indexOf("prio=") !== -1) {
        // Thread header contains "prio=" => we think it's complete
        return false;
      }
      if (line.indexOf("Thread t@") !== -1) {
        // Thread header contains a thread ID => we think it's complete
        return false;
      }
      if (line.substr(line.length - 2, 2) === '":') {
        // Thread headers ending in ": are complete as seen in the example here:
        // https://github.com/spotify/threaddump-analyzer/issues/12
        return false;
      }
      return true;
    };

    this._analyze = function(text) {
        var lines = text.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            while (this._isIncompleteThreadHeader(line)) {
                // Multi line thread name
                i++;
                if (i >= lines.length) {
                    break;
                }

                // Replace thread name newline with ", "
                line += ", " + lines[i];
            }

            this._handleLine(line);
        }

        this._identifyWaitedForSynchronizers();
    };

    // Returns an array [{threads:, stackFrames:,} ...]. The threads:
    // field contains an array of Threads. The stackFrames contain an
    // array of strings
    this._toThreadsAndStacks = function(specialClasses) {
        // Map stacks to which threads have them
        var stacksToThreads = {};
        for (var i = 0; i < this.threads.length; i++) {
            var thread = this.threads[i];
            //console.log(thread);
            // If specialClasses is provided, filter threads based on specialClasses either in stack trace or the thread header(name)
            // console.log(thread.name, specialClasses, thread.name.includes(specialClass));
            // console.log(`Thread name: '${thread.name}' (length: ${thread.name.length}), Special class: '${specialClass}' (length: ${specialClass.length})`);
            // console.log(`Contains special class: ${thread.name.includes(specialClass)}`);
            if (specialClasses && !(thread.containsSpecialClass(specialClasses) || thread.name.includes(specialClasses))) {
                continue; // Skip threads that do not contain special classes
            }
            
            console.log(`Hello there: ${thread.threadState} ${thread.name} ${thread.daemon}`);

            //console.log(thread.state)
            var stackString = thread.toStackString();
            if (!Object.prototype.hasOwnProperty.call(stacksToThreads, stackString)) {
                stacksToThreads[stackString] = [];
            }
            stacksToThreads[stackString].push(thread);
        }

        // List stacks by popularity
        var stacks = [];
        for (var stack in stacksToThreads) {
            if (!Object.prototype.hasOwnProperty.call(stacksToThreads, stack)) {
                continue;
            }

            stacks.push(stack);
        }
        stacks.sort(function(a, b) {
            if (a === b) {
                return 0;
            }

            var scoreA = stacksToThreads[a].length;
            if (a === EMPTY_STACK) {
                scoreA = -123456;
            }

            var scoreB = stacksToThreads[b].length;
            if (b === EMPTY_STACK) {
                scoreB = -123456;
            }

            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }

            // Use stack contents as secondary sort key. This is
            // needed to get deterministic enough output for being
            // able to run our unit tests in both Node.js and in
            // Chrome.
            if (a < b) {
                return -1;
            } else {
                return 1;
            }
        });

        // Iterate over stacks and for each stack, print first all
        // threads that have it, and then the stack itself.
        var threadsAndStacks = [];
        for (var j = 0; j < stacks.length; j++) {
            var currentStack = stacks[j];
            var threads = stacksToThreads[currentStack];

            threads.sort(function(a, b){
                if (a.name > b.name) {
                    return 1;
                }
                if (a.name < b.name) {
                    return -1;
                }
                return 0;
            });

            threadsAndStacks.push({
                threads: threads,
                stackFrames: threads[0].frames,
            });
        }

        return threadsAndStacks;
    };

    this._stackToHtml = function(stackFrames) {
        if (stackFrames.length === 0) {
            return '<div class="raw">' + htmlEscape(EMPTY_STACK) + "</div>\n";
        }

        var asHtml = "";
        var href;
        for (var i = 0; i < stackFrames.length; i++) {
            href = undefined;
            var stackFrame = stackFrames[i];

            if (this.countedRunningMethods.hasString(stackFrame)) {
                href = "#" + stringToId(stackFrame);
            }

            asHtml += '<div class="raw">	at ';

            if (href) {
                asHtml += '<a class="internal" href="' + href + '">';
            }
            asHtml += htmlEscape(stackFrames[i]);
            if (href) {
                asHtml += "</a>";
            }

            asHtml += "</div>\n";
            console.log(stackFrames);
        }

        return asHtml;
    };
 
    this.toHtml = function() {
        if (this.threads.length === 0) {
            return "";
        }
    
        specialThreadsAndStacks = this._toThreadsAndStacks(specialClasses);
        var allThreadsAndStacks = this._toThreadsAndStacks();
        var asHtml = "";
        
        var allFilteredThreads = [];
        var allFilteredThreadsandStacks = [];
        var state = threadStates;
        const threadNameCounts = getThreadNameCounts(this.threads);
        asHtml += "<h2>Thread Name Frequency</h2>\n";
        asHtml += '<table border="1" cellpadding="5" cellspacing="0">';
        asHtml += '<tr><th>Thread Name</th><th>Count</th><th>Examples</th></tr>';
        
        threadNameCounts
            .sort((a, b) => b.count - a.count)
            .forEach(({pattern, count, examples}) => {
                asHtml += '<tr>';
                asHtml += `<td>${htmlEscape(pattern)}*</td>`;
                asHtml += `<td>${count}</td>`;
                asHtml += `<td>${examples.slice(0, 3).map(name => htmlEscape(name)).join('<br>')}${examples.length > 3 ? '<br>...' : ''}</td>`;
                asHtml += '</tr>';
            });
        asHtml += '</table><br>';

        // Print special class threads
        if (specialThreadsAndStacks.length > 0) {

            //console.log(threadStates);
            asHtml += "<h2>Threads containing Keywords: " + specialClasses + "</h2>\n";
            asHtml += '<table border="1" cellpadding="5" cellspacing="0">';
            asHtml += '<tr><th>Number of Threads</th><th>Threads</th><th>Stack</th></tr>';
            for (var i = 0; i < specialThreadsAndStacks.length; i++) {

                var currentThreadsAndStack = specialThreadsAndStacks[i];
                var threads = currentThreadsAndStack.threads;
    
                // Filter threads based on the state if a state is specified
                var filteredThreads = threads;
                if (state && state.length > 0) {
                    //console.log(state);
                    filteredThreads = threads.filter(function(thread) {
                        if (thread.threadState) {
                            var firstWordOfState = thread.threadState.split(' ')[0]; // Extract the first word
                            console.log(thread.threadState, firstWordOfState, state.includes(firstWordOfState));
                            return state.includes(firstWordOfState);
                        }
                        return false; // Exclude threads without a valid threadState
                    });
                }

    
                if (filteredThreads.length > 0) {
                    
                    allFilteredThreads = allFilteredThreads.concat(filteredThreads)
                    allFilteredThreadsandStacks = allFilteredThreadsandStacks.concat({
                        stackTrace: currentThreadsAndStack.stackFrames,
                        threads: filteredThreads.length
                    });

                    asHtml += '<tr>';
                    asHtml += '<td>' + filteredThreads.length + '</td>';
    
                    // Preview for threads column
                    var threadsPreview = filteredThreads.map(function(thread) {
                        return thread.toHeaderHtml();
                    }).slice(0, 3).join("<br>") + '...';
                    asHtml += `<td><a href="#" data-type="threads" data-index="${i}" onclick="showDetails(this)">${threadsPreview}</a></td>`;
    
                    // Preview for stack column
                    var stackPreview = currentThreadsAndStack.stackFrames.slice(0, 3).join("<br>") + '...';
                    asHtml += `<td><a href="#" data-type="stack" data-index="${i}" onclick="showDetails(this)">${stackPreview}</a></td>`;
    
                    asHtml += '</tr>';
                }
            }
            
            asHtml += '</table>';

            // Passing all filtered out threads to generate a pie char
            var threadStateCounts = getThreadStateCounts(allFilteredThreads);
            createPieChart(threadStateCounts, allFilteredThreads);

            // Passing all filtered out stack traces and threads to generate a bar graph
            var stackTraceData = getStackTraceCounts(allFilteredThreadsandStacks);
            createBarChart(stackTraceData);

            // Create the doughnut chart for daemon and non-daemon threads
            createDaemonChart(allFilteredThreads);
        }
    
        return asHtml;
    }
    

    this.toIgnoresString = function() {
        return this._ignores.toString() + "\n";
    };

    this.toIgnoresHtml = function() {
        return this._ignores.toHtml();
    };

    this.toRunningString = function() {
        return this.countedRunningMethods.toString();
    };

    this.getSourceInfo = function(source){
        return [
            '<a class="internal" href="#thread-' + source.tid + '">',
            htmlEscape(source.name),
            "</a>",
        ].join("");
    };

    this.toRunningHtml = function() {
        var html = "";
        // var countedStrings = this.countedRunningMethods.getStrings();
        // for (var i = 0; i < countedStrings.length; i++) {
        //     var countedString = countedStrings[i];
        //     var ids = countedString.sources.map(this.getSourceInfo);
        //     html += '<tr id="';
        //     html += stringToId(countedString.string);
        //     html += '"><td class="vertical-align">';
        //     html += htmlEscape(countedString.string);
        //     html += '</td><td class="raw">';
        //     html += ids.join("<br>");
        //     html += "</td></tr>\n";
        // }
        return html;
    };

    this._countRunningMethods = function() {
        var countedRunning = new StringCounter();
        for (var i = 0; i < this.threads.length; i++) {
            var thread = this.threads[i];
            if (!thread.getStatus().isRunning()) {
                continue;
            }

            if (thread.frames.length === 0) {
                continue;
            }

            var runningMethod = thread.frames[0].replace(/^\s+at\s+/, "");
            countedRunning.addString(runningMethod, thread);
        }

        return countedRunning;
    };

    this.toSynchronizersHtml = function() {
        var html = "";
        for (var i = 0; i < this._synchronizers.length; i++) {
            var synchronizer = this._synchronizers[i];
            html += synchronizer.toHtmlTableRow() + "\n";
        }
        return html;
    };

    this._registerSynchronizer = function(registry, id, synchronizerClasses) {
        if (id === null) {
            return;
        }
        if (registry[id] === undefined) {
            registry[id] = new Synchronizer(id, synchronizerClasses[id]);
        }
    };

    // Create a mapping from synchronizer ids to Synchronizer
    // objects. Note that the Synchronizer objects won't get any cross
    // references from this method; they are don by
    // _enumerateSynchronizers() below.
    this._createSynchronizerById = function() {
        var returnMe = {};

        for (var i = 0; i < this.threads.length; i++) {
            var thread = this.threads[i];

            this._registerSynchronizer(
                returnMe, thread.wantNotificationOn, thread.synchronizerClasses);
            this._registerSynchronizer(
                returnMe, thread.wantToAcquire, thread.synchronizerClasses);

            for (var j = 0; j < thread.locksHeld.length; j++) {
                var lock = thread.locksHeld[j];
                this._registerSynchronizer(
                    returnMe, lock, thread.synchronizerClasses);
            }
        }

        return returnMe;
    };

    // Create a properly cross-referenced array with all synchronizers
    // in the thread dump
    this._enumerateSynchronizers = function() {
        for (var i = 0; i < this.threads.length; i++) {
            var thread = this.threads[i];
            var synchronizer;

            if (thread.wantNotificationOn !== null) {
                synchronizer = this._synchronizerById[thread.wantNotificationOn];
                synchronizer.notificationWaiters.push(thread);
            }

            if (thread.wantToAcquire !== null) {
                synchronizer = this._synchronizerById[thread.wantToAcquire];
                synchronizer.lockWaiters.push(thread);
            }

            for (var j = 0; j < thread.locksHeld.length; j++) {
                synchronizer = this._synchronizerById[thread.locksHeld[j]];
                synchronizer.lockHolder = thread;
            }
        }

        // List all synchronizers
        var synchronizers = [];
        var ids = Object.keys(this._synchronizerById);
        for (var k = 0; k < ids.length; k++) {
            var id = ids[k];
            synchronizers.push(this._synchronizerById[id]);
        }

        // Sort the synchronizers by number of references
        synchronizers.sort(synchronizerComparator);

        return synchronizers;
    };

    this.threads = [];
    this._ignores = new StringCounter();
    this._currentThread = null;

    this._analyze(text);
    this.countedRunningMethods = this._countRunningMethods();
    this._synchronizerById = this._createSynchronizerById();
    this._synchronizers = this._enumerateSynchronizers();
}
Analyzer.prototype.toHighCpuThreadsHtml = function(highCpuThreads) {
    if (!highCpuThreads || highCpuThreads.length === 0) {
        return ""; 
    }

    let html = '<table class="table table-bordered table-striped table-sm">'; // Added some Bootstrap classes for styling
    html += '<thead class="thead-dark"><tr><th>Thread Name</th><th>TID</th><th>CPU Time (ms)</th><th>Daemon</th><th>State</th></tr></thead>';
    html += '<tbody>';

    highCpuThreads.forEach(thread => {
        html += '<tr>';
        html += `<td>${htmlEscape(thread.name)}</td>`;
        html += `<td>${htmlEscape(thread.tid)}</td>`;
        html += `<td>${thread.cpuTime}</td>`;
        html += `<td>${thread.daemon ? 'Yes' : 'No'}</td>`;
        html += `<td>${htmlEscape(thread.threadState || 'N/A')}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
};

Analyzer.prototype.getHighCpuThreads = function(topN = 10) {
    const threadsWithCpuTime = this.threads.filter(thread => thread.cpuTime && thread.cpuTime > 0 && !thread.daemon && thread.threadState === 'RUNNABLE');
    threadsWithCpuTime.sort((a, b) => b.cpuTime - a.cpuTime);
    return threadsWithCpuTime.slice(0, topN); 
};


function openThreadsInStateWindow(state, threadsInState) {
    var newWindow = window.open("", "_blank");
    newWindow.document.write("<h2>Threads in state: " + state + "</h2>");
    newWindow.document.write("<ul>");
    threadsInState.forEach(function(thread) {
        newWindow.document.write("<li>" + thread.name + "</li>");
    });
    newWindow.document.write("</ul>");
}


function getThreadStateCounts(threads) {
    var threadStateCounts = {
        'RUNNABLE': 0,
        'BLOCKED': 0,
        'NEW': 0,
        'TERMINATED': 0,
        'TIMED_WAITING': 0,
        'WAITING': 0
    };

    threads.forEach(function(thread) {
        if (thread.threadState) {
            var state = thread.threadState.split(' ')[0];
            if (state in threadStateCounts) {
                threadStateCounts[state]++;
            }
        }

    });

    return threadStateCounts;
}



function getStackTraceCounts(allFilteredThreadsandStacks) {
    var stackTraceCounts = {};
    var actualStackTraces = {};
    var index = 1;

    allFilteredThreadsandStacks.forEach(function(stackTraces) {
       // Check if the stack trace is non-empty
       if (stackTraces.stackTrace && stackTraces.stackTrace.length > 0) {
        var stackTrace = "Stack Trace " + index;
        if (!(stackTrace in stackTraceCounts)) {
            stackTraceCounts[stackTrace] = stackTraces.threads;
            actualStackTraces[stackTrace] = stackTraces.stackTrace;
            index++;
        }
    }
    });

    console.log(index);

    // Sort the stack traces by count and keep only the top 10
    var sortedStackTraces = Object.entries(stackTraceCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    stackTraceCounts = Object.fromEntries(sortedStackTraces);

    return {stackTraceCounts, actualStackTraces};
}

function createPieChart(threadStateCounts, threads) {
    const labels = Object.keys(threadStateCounts);
    const counts = Object.values(threadStateCounts);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
    ];

    if (window.threadStateChartInstance) {
        window.threadStateChartInstance.destroy();
    }

    const ctx = document.getElementById('threadStateChart').getContext('2d');
    window.threadStateChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 2.75,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 14 },
                        usePointStyle: true,
                        generateLabels: chart => chart.data.labels.map((label, i) => ({
                            text: `${label}: ${chart.data.datasets[0].data[i]}`,
                            fillStyle: chart.data.datasets[0].backgroundColor[i],
                            strokeStyle: chart.data.datasets[0].backgroundColor[i],
                            hidden: false,
                            index: i
                        }))
                    }
                },
                title: {
                    display: true,
                    text: 'Thread State Statistics',
                    font: { size: 20 }
                }
            },
            animation: {
                onComplete: () => {
                    document.body.setAttribute('chart-done-threadStateChart', 'true');
                    checkAllChartsDone();
                }
            }
        }
    });
}

function createBarChart(stackTraceData) {
    const ctx = document.getElementById('stackTraceChart').getContext('2d');
    window.stackTraceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(stackTraceData.stackTraceCounts),
            datasets: [{
                data: Object.values(stackTraceData.stackTraceCounts),
                backgroundColor: '#003f5c',
                borderColor: '#58508d',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 3,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Threads with Identical Stack Trace (Top 10)',
                    font: { size: 20 }
                }
            },
            animation: {
                onComplete: () => {
                    document.body.setAttribute('chart-done-stackTraceChart', 'true');
                    checkAllChartsDone();
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const chart = elements[0].element.$context.chart;
                    const index = elements[0].index;
                    const label = chart.data.labels[index];
                    const stackLines = stackTraceData.actualStackTraces[label];
                    if (stackLines) {
                        const html = `<pre>${stackLines.join('\n')}</pre>`;
                        const win = window.open('', '_blank');
                        win.document.write(html);
                        win.document.close();
                    }
                }
            }
        }
    });
}

function createDaemonChart(threads) {
    const daemonThreads = threads
        .filter(t => t.daemon)
        .sort((a, b) => (b.cpuTime || 0) - (a.cpuTime || 0));

    const nonDaemonThreads = threads
        .filter(t => !t.daemon)
        .sort((a, b) => (b.cpuTime || 0) - (a.cpuTime || 0));

    if (window.daemonDonughtChartInstance) {
        window.daemonDonughtChartInstance.destroy();
    }

    const ctx = document.getElementById('daemonDonughtChart').getContext('2d');
    window.daemonDonughtChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Daemon Threads', 'Non‐Daemon Threads'],
            datasets: [{ data: [daemonThreads.length, nonDaemonThreads.length], backgroundColor: ['#ff7f0e', '#2ca02c'] }]
        },
        options: {
            responsive: true,
            aspectRatio: 2.75,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 14 },
                        generateLabels: chart => chart.data.labels.map((label, i) => ({
                            text: `${label}: ${chart.data.datasets[0].data[i]}`,
                            fillStyle: chart.data.datasets[0].backgroundColor[i],
                            hidden: false,
                            index: i
                        }))
                    }
                },
                title: {
                    display: true,
                    text: 'Daemon vs Non‐Daemon Threads',
                    font: { size: 20 }
                }
            },
            animation: {
                onComplete: () => {
                    document.body.setAttribute('chart-done-daemonDonughtChart', 'true');
                    checkAllChartsDone();
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const chart = elements[0].element.$context.chart;
                    const index = elements[0].index;
                    let threadList = [];
                    if (index === 0) {
                        threadList = daemonThreads;
                    } else if (index === 1) {
                        threadList = nonDaemonThreads;
                    }
                    if (threadList.length > 0) {
                        const html = `<pre>${threadList.map(t => t.name).join('\n')}</pre>`;
                        const win = window.open('', '_blank');
                        win.document.write(html);
                        win.document.close();
                    }
                }
            }
        }
    });
}

function checkAllChartsDone() {
    const allDone = ['chart-done-threadStateChart', 'chart-done-stackTraceChart', 'chart-done-daemonDonughtChart']
        .every(attr => document.body.getAttribute(attr) === 'true');
    if (allDone) {
        document.body.setAttribute('charts-render-complete', 'true');
    }
}

function getThreadNameCounts(threads) {
    const nameCounts = {};
    const patternMap = new Map();
    threads.forEach(thread => {
        const name = thread.name;
        const basePattern = name.split(/\d+/)[0].trim();
        if (nameCounts[basePattern]) {
            nameCounts[basePattern]++;
            patternMap.get(basePattern).push(name);
        } else {
            nameCounts[basePattern] = 1;
            patternMap.set(basePattern, [name]);
        }
    });
    const result = Object.entries(nameCounts).map(([pattern, count]) => ({
        pattern,
        count,
        examples: patternMap.get(pattern)
    }));
    return result;
}

