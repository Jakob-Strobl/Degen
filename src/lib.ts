import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";

export interface ProjectConfig {
    degen: DegenSettings;
    project: ProjectSettings;
    pages: PageTypes;
}

export interface DegenSettings {
    enable_html_in_markdown: boolean;
    warn_page_property_loads_default: boolean;
    warn_page_property_no_validation_rule: boolean;
    log_write_rendered_html: boolean;
}

export interface ProjectSettings {
    domain_url: string;
    source_path: string;
    export_path: string;
    passthrough: StringIndexableObject<string>;
}

export interface PageTypes {
    default: StringIndexableObject<any>         // The use needs to define at least a default type 
    [key: string]: StringIndexableObject<any>;  // Custom PageTypes 
}

export interface StringIndexableObject<T> {
    [key: string]: T;
}

export interface PathData {
    full_path: string;
    dir: string;
    file: string;
    ext: string;
    name: string;
}

export interface ProjectHints {
    source: DegenPath;
    export: DegenPath;
    domain_url: string;
}

export class DegenError extends Error {
    constructor(error_code: string, msg?: string, source?: string) {
        super(`[${error_code}] ${msg} >> ${source}`);
        this.name = "DegenError";
    }
}

export class DegenPath implements PathData {
    full_path: string;
    dir: string;
    file: string;
    ext: string;
    name: string;

    constructor(path: string) {
        try {
            this.full_path = Deno.realPathSync(path);
        } catch (e) {
            this.full_path = path;
        }
        this.dir = Path.dirname(this.full_path);
        this.file = Path.basename(this.full_path);
        this.ext = Path.extname(this.full_path);
        this.name = this.file.replace(this.ext, "");
    }
}