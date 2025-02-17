/*
 * Copyright (c) 2020 Martin Denham, Tuomas Airaksinen and the And Bible contributors.
 *
 * This file is part of And Bible (http://github.com/AndBible/and-bible).
 *
 * And Bible is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later version.
 *
 * And Bible is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with And Bible.
 * If not, see http://www.gnu.org/licenses/.
 */

import {
    getCurrentInstance,
    inject,
    nextTick,
    onBeforeMount,
    onUnmounted,
    reactive,
    ref,
    watch
} from "@vue/runtime-core";
import {sprintf} from "sprintf-js";
import {Deferred, setupWindowEventListener} from "@/utils";
import {computed} from "@vue/reactivity";
import {throttle} from "lodash";
import {emit, Events, setupEventBusListener} from "@/eventbus";
import {library} from "@fortawesome/fontawesome-svg-core";
import {
    faBookmark,
    faEdit,
    faEllipsisH,
    faHeadphones,
    faIndent,
    faOutdent,
    faPlusCircle,
    faSort,
    faTrash
} from "@fortawesome/free-solid-svg-icons";
import Color from "color";
import {DocumentTypes} from "@/constants";

let developmentMode = false;
export let testMode = false;

if(process.env.NODE_ENV === "development") {
    developmentMode = true;
}
if(process.env.NODE_ENV === "test") {
    testMode = true;
}

export function useVerseNotifier(config, calculatedConfig, mounted, {scrolledToVerse}, topElement, {isScrolling}) {
    const currentVerse = ref(null);
    watch(() => currentVerse.value,  value => scrolledToVerse(value));

    const lineHeight = computed(() => {
        config; // Update also when font settings etc are changed
        if(!mounted.value || !topElement.value) return 1;
        return parseFloat(window.getComputedStyle(topElement.value).getPropertyValue('line-height'));
        }
    );

    let lastDirection = "ltr";
    const step = 10;

    function *iterate(direction = "ltr") {
        if(direction === "ltr") {
            for (let x = window.innerWidth - step; x > 0; x -= step) {
                yield x;
            }
        } else {
            for (let x = step; x < window.innerWidth; x += step) {
                yield x;
            }
        }
    }

    const onScroll = throttle(() => {
        if(isScrolling.value) return;
        const y = calculatedConfig.value.topOffset + lineHeight.value*0.8;

        // Find element, starting from right
        let element;
        let directionChanged = true;
        while(directionChanged) {
            directionChanged = false;
            for(const x of iterate(lastDirection)) {
                element = document.elementFromPoint(x, y)
                if (element) {
                    element = element.closest(".ordinal");
                    if (element) {
                        const direction = window.getComputedStyle(element).getPropertyValue("direction");
                        if(direction !== lastDirection) {
                            directionChanged = true;
                            lastDirection = direction;
                            break;
                        }
                        currentVerse.value = parseInt(element.dataset.ordinal)
                        break;
                    }
                }
            }
        }
    }, 50);

    setupWindowEventListener('scroll', onScroll)
    return {currentVerse}
}

export const bookmarkingModes = {
    verticalColorBars: 0,
    blend: 1,
}

export const strongsModes = {
    off: 0,
    inline: 1,
    links: 2,
}

export let errorBox = false;

export function useConfig(documentType) {
    // text display settings only here. TODO: rename
    const config = reactive({
        bookmarkingMode: bookmarkingModes.verticalColorBars,
        developmentMode,
        testMode,

        showAnnotations: true,
        showChapterNumbers: true,
        showVerseNumbers: true,
        strongsMode: strongsModes.off,
        showMorphology: false,
        showRedLetters: false,
        showVersePerLine: false,
        showNonCanonical: true,
        makeNonCanonicalItalic: true,
        showSectionTitles: true,
        showStrongsSeparately: false,
        showCrossReferences: true,
        showFootNotes: true,
        fontFamily: "sans-serif",
        fontSize: 16,
        showBookmarks: true,
        showMyNotes: true,
        bookmarksHideLabels: [],
        bookmarksAssignLabels: [],

        colors: {
            dayBackground: -1,
            dayNoise: 0,
            dayTextColor: null,
            nightBackground: null,
            nightNoise: 0,
            nightTextColor: -16777216,
        },

        hyphenation: true,
        noiseOpacity: 50,
        lineSpacing: 10,
        justifyText: false,
        marginSize: {
            marginLeft: 0,
            marginRight: 0,
            maxWidth: 300,
        },
        topMargin: 0,
    });

    const appSettings = reactive({
        topOffset: 0,
        bottomOffset: 100,
        nightMode: false,
        errorBox: false,
        activeWindow: false,
    });

    function calcMmInPx() {
        const el = document.createElement('div');
        el.style = "width: 1mm;"
        document.body.appendChild(el);
        const pixels = el.offsetWidth;
        document.body.removeChild(el);
        return pixels
    }
    const mmInPx = calcMmInPx();

    const calculatedConfig = computed(() => {
        let topOffset = appSettings.topOffset;
        let topMargin = 0;
        if(documentType.value === DocumentTypes.BIBLE_DOCUMENT) {
            topMargin = config.topMargin * mmInPx;
            topOffset += topMargin;
        }
        return {topOffset, topMargin};
    });

    window.bibleViewDebug.config = config;

    setupEventBusListener(Events.SET_ACTIVE, newActive => {
        appSettings.activeWindow = newActive;
    });

    setupEventBusListener(Events.SET_CONFIG, async function setConfig({config: c, appSettings: {activeWindow, nightMode, errorBox: errorBoxVal}, initial = false} = {}) {
        const defer = new Deferred();
        if (!initial) emit(Events.CONFIG_CHANGED, defer)
        const oldValue = config.showBookmarks;
        config.showBookmarks = false
        await nextTick();
        for (const i in c) {
            if (config[i] !== undefined) {
                config[i] = c[i];
            } else if(!i.startsWith("deprecated")) {
                console.error("Unknown setting", i, c[i]);
            }
        }
        appSettings.nightMode = nightMode;
        appSettings.activeWindow = activeWindow;
        appSettings.errorBox = errorBoxVal;
        errorBox = errorBoxVal;
        if (c.showBookmarks === undefined) {
            // eslint-disable-next-line require-atomic-updates
            config.showBookmarks = oldValue;
        }
        config.showChapterNumbers = config.showVerseNumbers;
        if (!initial) {
            await nextTick();
        }
        defer.resolve()
    })

    return {config, appSettings, calculatedConfig};
}

export function useCommon() {
    const currentInstance = getCurrentInstance();

    const config = inject("config");
    const appSettings = inject("appSettings");
    const calculatedConfig = inject("calculatedConfig");

    const strings = inject("strings");

    const unusedAttrs = Object.keys(currentInstance.attrs).filter(v => !v.startsWith("__") && v !== "onClose");
    if(unusedAttrs.length > 0) {
        console.error("Unhandled attributes", currentInstance.type.name, currentInstance.attrs);
    }

    function split(string, separator, n) {
        return string.split(separator)[n]
    }

    function formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString()
    }

    function adjustedColor(color) {
        let col = Color(color);
        if(config.nightMode) {
            col = col.darken(0.2);
        } else {
            col = col.darken(0.2);
        }
        return col.hsl();
    }

    function abbreviated(str, n, useWordBoundary = true) {
        if(!str) return ""
        if (str.length <= n) { return str; }
        const lastSpaceIdx = str.lastIndexOf(" ");
        const subString = str.substr(0, Math.max(n-1, lastSpaceIdx)); // the original check
        return (useWordBoundary
            ? subString.substr(0, lastSpaceIdx)
            : subString) + "...";
    }

    return {config, appSettings, calculatedConfig, strings, sprintf, split, adjustedColor, formatTimestamp, abbreviated, emit, Events}
}

export function useFontAwesome() {
    library.add(faHeadphones)
    library.add(faEdit)
    library.add(faBookmark)
    library.add(faPlusCircle)
    library.add(faTrash)
    library.add(faEllipsisH)
    library.add(faSort)
    library.add(faIndent)
    library.add(faOutdent)
}

export function checkUnsupportedProps(props, attributeName, values = []) {
    const value = props[attributeName];
    const appSettings = inject("appSettings", {});
    if(!appSettings.errorBox) return;
    if(value && !values.includes(value)) {
        const tagName = getCurrentInstance().type.name
        const origin = inject("verseInfo", {}).osisID;
        console.warn(`${tagName}: Unsupported (ignored) attribute "${attributeName}" value "${value}", origin: ${origin}`)
    }
}

export function useJournal(label) {
    const journalTextEntries = reactive(new Map());
    const bookmarkToLabels = reactive(new Map());

    setupEventBusListener(Events.ADD_OR_UPDATE_BOOKMARKS, bookmarks => {
        for(const b of bookmarks) {
            if(b.bookmarkToLabels) {
                updateBookmarkToLabels(...b.bookmarkToLabels);
            }
        }
    });

    function updateJournalTextEntries(...entries) {
        for(const e of entries)
            if(e.labelId === label.id)
                journalTextEntries.set(e.id, e);
    }

    function updateBookmarkToLabels(...entries) {
        for(const e of entries)
            if(e.labelId === label.id)
                bookmarkToLabels.set(e.bookmarkId, e);
    }

    function updateJournalOrdering(...entries) {
        for(const e of entries) {
            journalTextEntries.get(e.id).orderNumber = e.orderNumber;
        }
    }
    function deleteJournal(journalId) {
        journalTextEntries.delete(journalId)
    }
    return {
        journalTextEntries,
        updateJournalTextEntries,
        updateJournalOrdering,
        updateBookmarkToLabels,
        bookmarkToLabels,
        deleteJournal
    };
}

export function useReferenceCollector() {
    const references = reactive([]);
    function collect(linkRef) {
        references.push(linkRef);
    }
    function clear() {
        references.splice(0);
    }
    return {references, collect, clear}
}

export function useVerseMap() {
    const verses = new Map();
    function register(ordinal, obj) {
        let array = verses.get(ordinal);
        if(array === undefined) {
            array = [];
            verses.set(ordinal, array);
        }
        array.push(obj);
    }
    function getVerses(ordinal) {
        return verses.get(ordinal) || []
    }
    return {register, getVerses}
}

export function useCustomCss() {
    const cssNodes = new Map();
    const count = new Map();
    const customCssPromises = [];
    function addCss(bookInitials) {
        const c = count.get(bookInitials) || 0;
        if (!c) {
            const link = document.createElement("link");
            const onLoadDefer = new Deferred();
            const promise = onLoadDefer.wait();
            customCssPromises.push(promise);
            link.href = `/module-style/${bookInitials}/style.css`;
            link.type = "text/css";
            link.rel = "stylesheet";
            const cssReady = () => {
                onLoadDefer.resolve();
                customCssPromises.splice(customCssPromises.findIndex(v => v === promise), 1);
            }
            link.onload = cssReady;
            link.onerror = cssReady;
            cssNodes.set(bookInitials, link);
            document.getElementsByTagName("head")[0].appendChild(link);
        }
        count.set(bookInitials, c + 1);
    }

    function removeCss(bookInitials) {
        const c = count.get(bookInitials);
        if(c > 1) {
            count.set(bookInitials, c-1);
        } else {
            count.delete(bookInitials);
            cssNodes.get(bookInitials).remove();
            cssNodes.delete(bookInitials);
        }
    }

    function registerBook(bookInitials) {
        addCss(bookInitials);
        onUnmounted(() => {
            removeCss(bookInitials);
        });
    }

    return {registerBook, customCssPromises}
}

export function useAddonFonts() {
    const elements = [];

    setupEventBusListener(Events.RELOAD_ADDONS, ({fontModuleNames}) => {
        reloadFonts(fontModuleNames)
    })

    function reloadFonts(fontModuleNames) {
        for(const e of elements) {
            e.remove();
        }
        elements.splice(0);
        for (const modName of fontModuleNames) {
            const link = document.createElement("link");
            link.href = `/fonts/${modName}/fonts.css`;
            link.type = "text/css";
            link.rel = "stylesheet";
            document.getElementsByTagName("head")[0].appendChild(link)
            elements.push(link);
        }
    }

    onBeforeMount(() => {
        const fontModuleNames = new URLSearchParams(window.location.search).get("fontModuleNames");
        if (!fontModuleNames) return
        reloadFonts(fontModuleNames.split(","));
    })
}
