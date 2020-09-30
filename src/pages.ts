import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { parse as parseToml } from "https://deno.land/std@0.69.0/encoding/toml.ts";

import * as Degen from "./lib.ts"; 
import { getProjectHints } from "./degen.ts";
import { Util } from "./util.ts";

const INDEX_OF_TOML_HEADER = 1;
const INDEX_OF_MARKDOWN = 2;
const INDEX_OF_PAGE_TYPE = 0;

export module Pages {
    // Key-values here are essential for Pages to function without error
    export interface PageDataFields extends Degen.StringIndexableObject<any> {
        path: Degen.DegenPath;
        template: Degen.DegenPath;
        export_path: Degen.DegenPath;
        is_public: boolean;
        page_type: string;
        body: string;
        url: string;
        // title: string;
    }

    export interface MarkdownPage {
        toml_header: Degen.StringIndexableObject<any>;
        markdown: string;
    }

    export interface ParsedPage {
        page_header: PageData;
        markdown: string;
    }

    export class PageError extends Degen.DegenError {
        constructor(error_code: string, msg: string, page: string) {
            super(error_code, msg, page);
            this.name = "PageError";
        }
    }

    /**
     * Given a opened file's data, strip the content into the header and the markdown body and create a page.
     * @param page_text opened file's data
     * @param path Path to file
     */
    export function parsePage(page_text: string, path: Degen.DegenPath) : Pages.Page {
        if (page_text.length === 0) {
            throw new PageError(
                "P101",
                "Degen was given an empty page to parse",
                path.full_path); // P101
        }

        const {toml_header, markdown} = splitTomlHeaderAndMarkdown(page_text, path);
        const page = Pages.createPage(toml_header, path, markdown);
        return page
    }

    /**
     * Split the header and body 
     * @param page_text Opened file's data
     * @param path      Path to file
     */
    export function splitTomlHeaderAndMarkdown(page_text: string, path: Degen.DegenPath) : Pages.MarkdownPage {
        const page_pieces =  page_text.split('---'); // 0 - empty, 1 - header, 2 - body 
        if (page_pieces.length !== 3) {
            throw new PageError(
                "P102",
                "Page header is not formatted correctly",
                path.full_path); // P102
        }

        const toml_header = <Degen.StringIndexableObject<any>> parseToml(page_pieces[INDEX_OF_TOML_HEADER]); 
        return {
            toml_header,
            markdown: page_pieces[INDEX_OF_MARKDOWN]
        };
    }

    /**
     * Creates a Degen Page (see Pages.Page) 
     *  - Wraps the Page Constructor to streamline page creation
     * 
     * @param toml_header   Toml header stripped from the top of the page's content
     * @param path          DegenPath which points to the source location of the page's content
     * @param markdown      The page's markdown 
     */
    export function createPage(toml_header: Degen.StringIndexableObject<any>, path: Degen.DegenPath, markdown: string) : Page  {
        if (Object.keys(toml_header).length !== 1) {
            throw new PageError(
                "P103", 
                "Page Header Misconfigured; A page must contain one table to define its type: [post], etc", 
                path.full_path);
        }
        
        const page_type = Object.keys(toml_header)[INDEX_OF_PAGE_TYPE]; // Page type should always be the first and only parent property in the toml header
        const header = toml_header[page_type];
        header["path"] = path;
        header["page_type"] = page_type;
        header["markdown"] = markdown;
        
        const page = new Page(header);
        return page;
    }

    /**
     * PageData handles all the internal operations of keeping track, retrieving, and inferring page properties for each page.
     *  - This is the lowest level abstraction of a page's properties
     */
    export class PageData {
        private _data: PageDataFields;

        constructor(header: PageDataFields) {
            this._data = header;
        }

        set(key: string, value: any) {
            this._data[key] = value;
        }

        isValidKey(key: string) : boolean {
            return key in this._data;
        }

        values(): Array<any> {
            return Object.values(this._data);
        }

        /**
         * Get the property of a page matching the key given or throw an error 
         * @param key the property you want
         */
        get(key: string): any {
            // Validate input
            if (this.isValidKey(key)) {
                return this._data[key];
            } else {
                throw new PageError(
                    "P200", 
                    `key '${key}' does not exist in the header.`,
                    this.get('path').full_path);
            }
        }

        /**
         * Return the raw object storing all the properties (key-value pairs) of the page 
         */
        getData() {
            return this._data;
        }

        /**
         * Helper function: returns a string of the relative source path relative to the project config's source path
         * @throws PageError if it can't determine the source path correctly 
         */
        getRelativeSourcePath() {
            const file_path = this.get('path').full_path;
            const base_path : Degen.ProjectHints = getProjectHints(); //this.get('project_source_path');
            const leftover_path = file_path.split(base_path.source.full_path);
            if (leftover_path.length !== 2) {
                throw new PageError(
                    "P201",
                    `Relative Source Path could not be determined - ${leftover_path}`,
                    this.get('path').full_path);
            }
            
            return leftover_path[1];
        }

        /**
         * Makes sure a Page is ready to go:
         *  1. Loads default values defined in project config based on page type -> populateDefaultProperties()
         *  2. Checks each property passes its ruleset (if that property has a ruleset defined) -> validateHeaderProperty()
         *  3. Determines some extra internal properties based on existing/required properties -> inferProperties()
         */
        finalizeHeader() {
            const config = Util.getProjectConfigSync(); // Get project config so we know to print warnings
            const page_defaults = config.pages;
            const page_type = this.get('page_type');
            
            if (page_defaults) {
                // Check if header's page type exists in page default types
                if (page_type in page_defaults) {
                    this.populateDefaultProperties(page_defaults[page_type], config.degen);
                } else {
                    // Use default page type
                    this.populateDefaultProperties(page_defaults.default, config.degen);
                }
            }
            
            // validate all properties in this header 
            for (const key in this._data) {
                this.validateHeaderProperty(key, config.degen);
            }

            this.inferProperties();
        }

        /**
         * Populate this pages properties with default values via a defualt table
         * @param defaults object containing default page key-value pairs 
         * @param degen_settings set log level of warnings via project config 
         */
        private populateDefaultProperties(defaults: any, degen_settings: Degen.DegenSettings) {
            // Load default values if property is empty
            for (const key in defaults) {
                if ( !(key in this._data) ) {
                    // populate with default property 
                    this.set(key, defaults[key]);
                    if (degen_settings.warn_page_property_loads_default) {
                        console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${this.get('path').full_path}', "${key}" was not found in the header.\n\tLoading default: "${this.get(key)}"\n`);
                    }
                }
            }
        }

        /**
         * Check if a given property (key) passes its defined ruleset
         *  - if a ruleset isn't defined it will automatically pass
         * @param key the property to check
         * @throws PageError when a paroperty fails its ruleset 
         */
        private validateHeaderProperty(key: string, degen_settings: Degen.DegenSettings) {        
            switch (key) {
                // Add rules for properties in here!
                case "is_public": {
                    if (typeof this.get(key) !== 'boolean') {
                        throw new PageError(
                            "P300", 
                            "'is_public' page property must be a boolean",
                            this.get('path').full_path);
                    }
                    break;
                }
                case "date": {
                    const date = this.get(key);
                    if (date) {
                        // Check is parseable by date - i.e. parseable by toml
                        if (Date.parse(date)) {
                            break;
                        }

                        // Check if it is 'modified', 'created'
                        let date_regx = RegExp(/modified|created/i);
                        if ( !date_regx.test(date) ) {
                            throw new PageError(
                                "P301",
                                `'date' page property must be either "modified", "created", or in a Date() parseable format. Found "${date}"`,
                                this.get('path').full_path);
                        }
                    }
                    break;
                }

                default: {
                    if (degen_settings.warn_page_property_no_validation_rule) {
                        console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${this.get('path').full_path}', the key "${key}" has no rules for parsing.\n\tYou can add a rule in lib.ts - PageHeader.validateHeaderProperty()\n`);
                    }
                    break;
                }
            }
        }

        /**
         * Create more properties for the page based on existing property values
         *  - This function is destructive, so be careful
         * 
         * @throws PageError when a property could not be correctly inferred 
         */
        private inferProperties() {
            // This syntax might look a little weird but its to encapsulate the variable namespace
            const relative_source_path = this.getRelativeSourcePath();
            const project_hints : Degen.ProjectHints = getProjectHints();
            { // export path - match the same file structure as the source
                const path =  project_hints.export.full_path + relative_source_path.replace('.md', '.html')
                this.set('export_path', new Degen.DegenPath(path)); // Replace file extension with .html 
            }
            { // Tempalte path - convert to DegenPath
                const path = this.get('template');
                this.set('template', new Degen.DegenPath(path));
            }
            { // URL
                const export_path = this.get('export_path').full_path;
                const paths = export_path.split(project_hints.export.full_path);
                if (paths.length === 2) {
                    this.set('url', `${project_hints.domain_url}${paths[1]}`);
                } else {
                    throw new PageError(
                        "P401",
                        "URL Path could not be determined",
                        this.get('path').full_path);
                }
            }
            { // Date
                let date: any = this.get('date');
                if ( !Date.parse(date) ) {
                    date = date.toLowerCase();
                    const stats = Deno.statSync(this.get('path').full_path);
                    if (date === "created") {
                        this.set('date', stats.birthtime);
                    } else if (date === "modified") {
                        this.set('date', stats.mtime);
                    }
                }
            }
        }

        printHeader() {
            console.log("Printing header:");
            for (const key in this._data) {
                console.log(`  ${key}: ${this.get(key)}`)
            }
        }
    }

    /**
     * Page is a minimal wrapper class over PageData
     *  - An abstraction layer to ease construction of PageData and add quality of life methods to Pages
     */
    export class Page extends PageData {
        constructor(header: Degen.StringIndexableObject<any>) {
            const page_header = <PageDataFields> {
                ...header, // spread/expand the TomlHeader object
            };
            super(page_header);
            this.finalizeHeader();
        }

        // QOL Convenience methods for better template expression readability
        url() : string {
            return this.get('url');
        }

        title() : string {
            return this.get('title');
        }

        body(length?: number) : string {
            return this.get('body').substring(0, length);
        }

        markdown() {
            return this.get('markdown');
        }
    }

    /**
     * PageCollections are a grouping of Pages based on some qualitative property 
     */
    export class PageCollection {
        group: string // for easier debugging / identification 
        pages: Array<Page>

        constructor(group: string, pages?: Array<Page>) {
            this.group = group; 

            if ( !pages )
                this.pages = Array<Page>();
            else 
                this.pages = pages; // shallow copy 
            
        }

        /**
         * Add a page to the page collection
         * 
         * @param page 
         */
        push(page: Page) {
            this.pages.push(page);
        }

        /**
         * Sorts the page collection based on the key given
         * @param key the property to sort by
         * @param reverse [optional] reverse the order of the sort
         * @returns SortedPageCollection
         */
        sort(key: string, reverse=false) : SortedPageCollection {
            let reverse_coef = reverse ? -1 : 1;
            let sorted;

            sorted = this.pages.sort((pageA, pageB) => {
                const propA = pageA.get(key);
                const propB = pageB.get(key);
                
                if (propA < propB) {
                    return -1 * reverse_coef;
                } else if (propA > propB) {
                    return 1 * reverse_coef;
                }

                // equal
                return 0;
            });

            return new SortedPageCollection(this.group.concat(".sort()"), sorted);
        }

        /**
         * Take the first <num> items in the array
         * @param num number of items to take
         */
        take(num: number) : PageCollection {
            return new PageCollection(this.group.concat(".take()"), this.pages.slice(0, num));
        }

        /**
         * Find a page in the collection by its source path
         * @param path the source path to match for 
         * @returns PageCollection - A single page on a match, empty on no match
         */
        find(path: string) : PageCollection {
            let page;
            
            let src_path = Deno.realPathSync(path);
            console.log(`Looking for a page with the path: ${src_path}`);
            for (let i = 0; i < this.pages.length; i++) {
                if (this.pages[i].get('file_path') === src_path) {
                    page = this.pages[i];
                    break;
                }
            }

            if (page) {
                return new PageCollection(this.group.concat(".find()"), [page]);
            } else {
                return new PageCollection(this.group.concat(".find()"));
            }
        }

        /**
         * Filters out the page given from the PageCollection by it's absolute source path
         *  
         * @param current_page the page we want to exclude
         */
        exclude(current_page: Page) : PageCollection {
            return this.filter((page: Page) => page.get('path').full_path !== current_page.get('path').full_path);
        }

        /**
         * Filter the PageCollection using a callback 
         * @param callback function defined in template expression 
         * @returns filtered PageCollection
         */
        filter(callback: Function) : PageCollection {
            const passed = [];
            for (let i = 0; i < this.pages.length; i++) {
                if (callback(this.pages[i], i, this.pages)) {
                    passed.push(this.pages[i]);
                }
            }
            return new PageCollection(this.group.concat(".filter()"), passed);
        }

        /**
         * Maps the PageCollection using a callback
         * @param callback function defined in template expression
         * @returns shallow-mapped PageCollection
         */
        map(callback: Function) : PageCollection {
            const mapped = [];
            for (let i = 0; i < this.pages.length; i++) {
                mapped.push(callback(this.pages[i], i, this.pages));
            }

            return new PageCollection(this.group.concat(".map()"), mapped);
        }

        /**
         * Maps a deep-copied PageCollection using a callback 
         * @param callback function defined in template expression
         * @returns deep-mapped PageCollection
         */
        mapNew(callback: Function) : PageCollection {
            const mapped = [];
            // This feels dirty but it works :P - deep copy
            const unique_pages = this.pages.map((page) => {
                return new Page(JSON.parse(JSON.stringify(page.getData())));
            });

            for (let i = 0; i < this.pages.length; i++) {
                mapped.push(callback(unique_pages[i], i, unique_pages));
            }

            return new PageCollection(this.group.concat(".mapNew()"), mapped);
        }

        /**
         * Render each page using the given callback
         * IF the PageCollection is empty:
         *      return the fallback string
         *      otherwise print null
         * @param callback callback which returns a string to render to html 
         * @param fallback fallback string to return if PageCollection is empty
         * @returns a string to place in the rendered html file
         */
        render(callback: Function, fallback?: string) : string {
            console.log(`Rendering group: ${this.group}`);
            if (this.pages.length > 0) {
                const rendered = []
                for (let i = 0; i < this.pages.length; i++) {
                    rendered.push(callback(this.pages[i], i, this.pages))
                }
                return rendered.join("\n");
            } else if (fallback) {
                return fallback;
            }

            return "null";
        }

        toString(indent_size: number) : string {
            let str = ``;
            let indent = " ".repeat(indent_size);

            this.pages.forEach((page) => {
                str += `${indent}Page '${page.get('path').file}' - ${page.getData().page_type}\n`
            });

            return str;
        }
        
        /**
         * This function should only be called by a SortedPageCollection
         *  - defined here just to throw an error
         * @param num 
         * @throws PageError for using it on an unordered PageCollection
         */
        head(num=1) {
            throw new PageError('P500', "head() is not useable for an unordered page collection", this.group);
        }

        /**
         * This function should only be called by a SortedPageCollection
         *  - defined here just to throw an error
         * @param num 
         * @throws PageError for using it on an unordered PageCollection
         */
        tail(num=1) {
            throw new PageError('P501', "tail() is not useable for an unordered page collection", this.group);
        }
    }

    /**
     * Just like a PageCollection, except we know its sorted, so we can provide a couple more convenient functions 
     */
    export class SortedPageCollection extends PageCollection {
        head(num=1) {
            return new SortedPageCollection(this.group.concat('.head()'), this.pages.slice(0,num));
        }

        tail(num=1) {
            const size = this.pages.length;
            return new SortedPageCollection(this.group.concat('.tail()'), this.pages.slice(size-num));
        }
        
        // TODO I will be updating the execution environment in the future, so lets not touch this for now.
        next(reference: Page, num=1) {
        }

        prev(base: Page, num=1) {
        }
    }

    /**
     * The Compendium is essentially a collection of collections.
     * It is used as an entry point to all the different collections
     *  and to figure out which collection a page belongs to.
     */
    export class Compendium {
        collections: Degen.StringIndexableObject<PageCollection>; 

        constructor(collection?: Degen.StringIndexableObject<PageCollection>) {
            if (collection)
                this.collections = collection;
            else 
                this.collections = <Degen.StringIndexableObject<PageCollection>> {};
        }

        /**
         * Add a page to its relevant collections
         * @param page The page we want to add
         */
        addPage(page: Page) {
            // Add page to its page_type collection
            // Collection name is pluralized for better readiblity
            const collection_name = page.get('page_type');
            this.get(collection_name).push(page);

            // TODO split by category? Multiple categories
        }

        /**
         * Get a collection by name
         *  If the collection does not exist, create a new collection and return that.
         * @param collection The collection we want 
         */
        get(collection: string) : PageCollection {
            if ( !(collection in this.collections) )
                this.collections[collection] = new PageCollection(collection);

            return this.collections[collection];
        }

        toString() : string {
            let str = ``;
            for (const collection in this.collections) {
                str += `collection '${collection}':\n${this.collections[collection].toString(3)}`;
            }
            return str;
        }
    }
}