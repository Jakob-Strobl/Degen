import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { parse as parseToml } from "https://deno.land/std@0.69.0/encoding/toml.ts";

import * as Degen from "./lib.ts"; 
import { Util } from "./util.ts";


const INDEX_OF_TOML_HEADER = 1;
const INDEX_OF_MARKDOWN = 2;

export module Pages {
    // Key-values here are essential for Pages to function without error
    export interface PageDataFields extends Degen.StringIndexableObject<any> {
        page_type: string;
        filename: string;
        page_path: string;
        body: string;
        template: string;
        is_public: boolean;
        export_path: string;
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

    export function parsePage(page_text: string, page_path: string, config: Degen.ProjectConfig) : Pages.Page {
        if (page_text.length === 0) {
            // TODO update to PageError
            throw new Error(`Degen was given an empty page to parse: ${page_path}`); // P101
        }

        const {toml_header, markdown} = splitTomlHeaderAndMarkdown(page_text, page_path);
        const page = Pages.createPage(toml_header, page_path, markdown, config);
        return page
    }

    export function splitTomlHeaderAndMarkdown(page_text: string, page_path: string) : Pages.MarkdownPage {
        const page_pieces =  page_text.split('---'); // 0 - empty, 1 - header, 2 - body 
        if (page_pieces.length !== 3) {
            // TODO update to PageError
            throw Error(`Page header is not formatted correctly: ${page_path}`); // P102
        }

        const toml_header = <Degen.StringIndexableObject<any>> parseToml(page_pieces[INDEX_OF_TOML_HEADER]); 
        return {
            toml_header,
            markdown: page_pieces[INDEX_OF_MARKDOWN]
        };
    }

    // TODO add documentation for this function 
    // TODO refactor path and name into one of Deno's file path objects 
    export function createPage(toml_header: Degen.StringIndexableObject<any>, page_absolute_path: string, markdown: string, config: Degen.ProjectConfig) : Page  {
        if (Object.keys(toml_header).length !== 1) {
            throw new PageError(
                "P103", 
                "Page Header Misconfigured; A page must contain one table to define its type: [post], etc", 
                page_absolute_path);
        }
        
        const page_type = Object.keys(toml_header)[0]; // Page type should always be the first and only parent property in the toml header
        const header = toml_header[page_type];
        header["filename"] = Path.basename(page_absolute_path);
        header["page_path"] = page_absolute_path;
        header["page_type"] = page_type;
        header["markdown"] = markdown;
        try {
            // If path doesnt exist, throws OS error
            header["base_source_path"] = Deno.realPathSync(config.settings.pages.source_path);
        } catch (e) {
            console.error(`ERROR: Project Config's 'source_path' could not be found: ${config.settings.pages.source_path}`);
            console.error(e);
            Deno.exit();
        }
        try {
            // If path doesnt exist, throws OS error
            header["base_export_path"] = Deno.realPathSync(config.settings.pages.export_path);
        } catch (e) {
            console.error(`ERROR: Project Config's 'export_path' could not be found: ${config.settings.pages.export_path}`);
            console.error(e);
            Deno.exit();
        }
        const page = new Page(header, config.pages);
        return page;
    }

    export class PageData {
        private _data: PageDataFields;

        constructor(header: PageDataFields) {
            this._data = header;
        }

        set(key: string, value: any) {
            this._data[key] = value;
        }

        setBody(body: string) {
            this._data.body = body;
        }

        isValidKey(key: string) : boolean {
            return key in this._data;
        }

        getData() {
            return this._data;
        }

        getFilename() {
            return this._data.filename;
        }

        getRelativeSourcePath() {
            const file_path = this.get('page_path');
            const base_path = this.get('base_source_path');
            const leftover_path = file_path.split(base_path);
            if (leftover_path.length !== 2) {
                throw Error(`Relative Source Path could not be determined:\n${leftover_path}`)
            }
            
            return leftover_path[1];
        }

        getExportDir() {
            let path = this._data.export_path.match(/.+[^\w.html]/);
            if (path) {
                return path[0];
            } else {
                throw Error("getExportDir() did not match regular expression");
            }
        }
        
        get(key: string): any {
            // Validate input
            if (this.isValidKey(key)) {
                return this._data[key];
            } else {
                throw new PageError(
                    "P200", 
                    `key '${key}' does not exist in the header.`,
                    this._data['page_path']);
            }
        }

        values(): Array<any> {
            return Object.values(this._data);
        }

        finalizeHeader(page_defaults?: Degen.PageTypes) {
            const page_type = this.get('page_type');
            if (page_defaults) {
                // Check if header's page type exists in page default types
                if (page_type in page_defaults) {
                    this.populateDefaultProperties(page_defaults[page_type]);
                } else {
                    // Use default page type
                    this.populateDefaultProperties(page_defaults.default);
                }
            }
            
            // validate all properties in this header 
            for (const key in this._data) {
                this.validateHeaderProperty(key);
            }

            this.inferProperties();
        }

        private populateDefaultProperties(defaults: any) {
            // Load default values if property is empty
            for (const key in defaults) {
                if ( !(key in this._data) ) {
                    // populate with default property 
                    this.set(key, defaults[key]);
                    console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${this.get('page_path')}', "${key}" was not found in the header.\n\tLoading default: "${this.get(key)}"\n`);
                }
            }
        }

        /**
         * Update, validate, polish off header properties 
         * @param key the key you want to check 
         */
        private validateHeaderProperty(key: string) {        
            let page_path: string = this.get('page_path');
            switch (key) {
                // Add rules for properties in here!
                case "is_public": {
                    if (typeof this.get(key) !== 'boolean') {
                        throw new PageError(
                            "P300", 
                            "'is_public' page property must be a boolean",
                            page_path);
                    }
                    break;
                }
                case "date": {
                    const date = this.get(key);
                    console.log
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
                                page_path);
                        }
                    }
                    break;
                }

                default: {
                    console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${page_path}', the key "${key}" has no rules for parsing.\n\tYou can add a rule in lib.ts - PageHeader.validateHeaderProperty()\n`);
                    break;
                }
            }
        }

        /**
         * Create more properties for the page based on existing property values
         *  - This function is destructive, so be careful
         */
        private inferProperties() {
            // This syntax might look a little weird but its to encapsulate the variable namespace
            const relative_source_path = this.getRelativeSourcePath();
            { // export path - match the same file structure as the source
                const path = this.get('base_export_path') + relative_source_path.replace('.md', '.html')
                this.set('export_path', path); // Replace file extension with .html 
            }
            { // URL
                const base_path = this.get('base_export_path');
                const export_path = this.get('export_path');
                const paths = export_path.split(base_path);
                if (paths.length === 2) {
                    this.set('url', paths[1]);
                } else {
                    // TODO update to PageError
                    throw Error("URL Path could not be determined");
                }
            }
            { // Date
                let date: any = this.get('date');
                if ( !Date.parse(date) ) {
                    date = date.toLowerCase();
                    const stats = Deno.statSync(this._data.page_path);
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

    // Intermediate representation of a page
    export class Page extends PageData {
        constructor(header: Degen.StringIndexableObject<any>, default_header?: Degen.PageTypes) {
            const page_header = <PageDataFields> {
                ...header, // spread/expand the TomlHeader object
            };
            super(page_header);
            this.finalizeHeader(default_header);
        }

        // QOL Convenience functions for better template expression readability
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

    // Intermediate Representation of a grouping of pages
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

        push(page: Page) {
            this.pages.push(page);
        }

        sort(key: string, reverse=false) : PageCollection {
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


            return new PageCollection(this.group.concat(".sort()"), sorted);
        }

        // Take the first <num> items in the array
        take(num: number) : PageCollection {
            return new PageCollection(this.group.concat(".take()"), this.pages.slice(0, num));
        }

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

        exclude(current_page: Page) : PageCollection {
            return this.filter((page: Page) => page.get('page_path') !== current_page.get('page_path'));
        }

        // Filter PageCollection
        filter(callback: Function) : PageCollection {
            const passed = [];
            for (let i = 0; i < this.pages.length; i++) {
                if (callback(this.pages[i], i, this.pages)) {
                    passed.push(this.pages[i]);
                }
            }
            return new PageCollection(this.group.concat(".filter()"), passed);
        }

        // Maps the PageCollection in-place
        map(callback: Function) : PageCollection {
            const mapped = [];
            for (let i = 0; i < this.pages.length; i++) {
                mapped.push(callback(this.pages[i], i, this.pages));
            }

            return new PageCollection(this.group.concat(".map()"), mapped);
        }

        // Maps a deep-copied PageCollection 
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
                str += `${indent}Page '${page.getFilename()}' - ${page.getData().page_type}\n`
            });

            return str;
        }
    }

    // TODO Worth implementing? Good use case??
    export class SortedPageCollection extends PageCollection {
        // TODO implement ???
        
        next(reference: Page, num=1) {
        }

        prev(base: Page, num=1) {
        }
    }

    // Intermediate Representation of all the collections - The entry point to all the different collections
    export class Compendium {
        collections: Degen.StringIndexableObject<PageCollection>; 

        constructor(collection?: Degen.StringIndexableObject<PageCollection>) {
            if (collection)
                this.collections = collection;
            else 
                this.collections = <Degen.StringIndexableObject<PageCollection>> {};
        }

        // Insert the page into its relevant groups
        addPage(page: Page) {

            // Add page to its page_type collection
            // Collection name is pluralized for better readiblity
            const collection_name = page.get('page_type');
            this.get(collection_name).push(page);

            // TODO split by category? Multiple categories
        }

        // If group doesnt exist it creates the group
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