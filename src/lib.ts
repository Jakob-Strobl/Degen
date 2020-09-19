export interface ProjectConfig {
    settings: Settings;
    pages: PageTypes;
}
    
export interface Settings {
    degen: DegenSettings;
    pages: PageSettings;
    passthrough: StringIndexableObject<string>;
}

export interface DegenSettings {
    printTomlHeaderWarnings: boolean;
    enable_html_in_markdown: boolean;
}

export interface PageSettings {
    source_path: string;
    export_path: string;
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

