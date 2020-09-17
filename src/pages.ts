import * as Degen from "./lib.ts"; 
import { Util } from "./util.ts";


export module Pages {
    // Key-values here are essential for Pages to function without error
    export interface PageDataFields extends Degen.StringIndexableObject<any> {
        page_type: string;
        filename: string;
        file_path: string;
        body: string;
        template_path: string;
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

    export function createPage(toml_header: Degen.StringIndexableObject<any>, filename: string, markdown: string, config: Degen.ProjectConfig) : Page  {
        if (Object.keys(toml_header).length !== 1) {
            throw Util.createError(Degen.ErrorCode.PAGE_HEADER_MISCONFIGURED, 
                filename, 
                "page header must contain one table to define its type: [post], [project], etc");
        }

        const page_type = Object.keys(toml_header)[0];
        const header = toml_header[page_type];
        header["filename"] = filename.match(/\w+.md/)?.toString();
        header["file_path"] = filename;
        header["page_type"] = page_type;
        header["source_path"] = Deno.realPathSync(config.settings.pages.source_directory);
        header["relative_export_path"] = Deno.realPathSync(config.settings.pages.export_path);
        header["markdown"] = markdown;
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

        getRelativeSourcePath() {
            return this._data.file_path.split(this._data.source_path)[1];
        }

        getFilePathDir() {
            let path = this._data.filename.match(/.+[^\w.md]/);
            if (path) {
                return path[0];
            } else {
                throw Error("getExportDir did not match regular expression");
            }
        }

        getFilename() {
            return this._data.filename;
        }

        getExportFilename() {
            return this._data.filename.replace('.md', '.html');
        }

        getExportDir() {
            let path = this._data.export_path.match(/.+[^\w.html]/);
            if (path) {
                return path[0];
            } else {
                throw Error("getExportDir did not match regular expression");
            }
        }
        
        get(key: string): any {
            // Validate input
            if (this.isValidKey(key)) {
                return this._data[key];
            } else {
                throw Util.createError(Degen.ErrorCode.PAGE_HEADER_KEY_VALUE_DNE, 
                    this._data['file_path'],
                    `key '${key}' does not exist in the header.`);
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
                    console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${this.get('file_path')}', "${key}" was not found in the header.\n\tLoading default: "${this.get(key)}"\n`);
                }
            }
        }

        /**
         * Update, validate, polish off header properties 
         * @param key the key you want to check 
         */
        private validateHeaderProperty(key: string) {        
            let file_path: string = this.get('file_path');
            switch (key) {
                // Add rules for properties in here!
                case "is_public": {
                    if (typeof this.get(key) !== 'boolean') {
                        throw Util.createError(Degen.ErrorCode.ERROR, 
                            file_path, 
                            'is_public must be a boolean.');
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
                            throw Util.createError(Degen.ErrorCode.ERROR,
                                file_path,
                                `date property must be either "modified", "created", or in a Date() parseable format. Found: ${date}`);
                        }
                    }
                    break;
                }

                default: {
                    console.warn(`WARN: In ${this._data.page_type.toUpperCase()} - '${file_path}', the key "${key}" has no rules for parsing.\n\tYou can add a rule in lib.ts - PageHeader.validateHeaderProperty()\n`);
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
                console.log(`relsrc: ${relative_source_path}`);
                const export_path = this.get('relative_export_path');
                const path = `${export_path}${relative_source_path.replace('.md', ".html")}`;
                this.set('export_path', `${path}`); // Replace file extension with .html 
            }
            { // URL
                const path = this.get('export_path').split(this.get('relative_export_path'))[1];
                this.set('url', `${path}`);
            }
            { // Date
                let date: any = this.get('date');
                if ( !Date.parse(date) ) {
                    date = date.toLowerCase();
                    const stats = Deno.statSync(this._data.file_path);
                    if ( date === "created") {
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
        // TODO this constructor is actually awful and isnt flexible
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
            return this.filter((page: Page) => page.get('file_path') !== current_page.get('file_path'));
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