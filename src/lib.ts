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
    [key: string]: StringIndexableObject<any>; // Custom PageTypes 
}

export interface StringIndexableObject<T> {
    [key: string]: T;
}

export class DegenError extends Error {
    constructor(error_code: string, msg?: string, source?: string) {
        super(`[${error_code}] ${msg} >> ${source}`);
        this.name = "DegenError";
    }
}

