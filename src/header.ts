import { parse as parseToml } from "https://deno.land/std@0.67.0/encoding/toml.ts";
import * as Statis from "./lib.ts";
import { Pages } from "./pages.ts"

const INDEX_OF_TOML_HEADER = 1;
const INDEX_OF_MARKDOWN = 2;

export module Header {
    export function parseStatisPage(page_text: string, page_filename: string, config: Statis.ProjectConfig) : Pages.Page {
        const {toml_header, markdown} = splitTomlHeaderAndMarkdown(page_text);
        const page = Pages.createPage(toml_header, page_filename, markdown, config);
        return page
    }

    export function splitTomlHeaderAndMarkdown(page_text: string) : Pages.MarkdownPage {
        const page_pieces =  page_text.split('---'); // 0 - empty, 1 - header, 2 - body 
        const toml_header = <Statis.StringIndexableObject<any>> parseToml(page_pieces[INDEX_OF_TOML_HEADER]); 

        return {
            toml_header,
            markdown: page_pieces[INDEX_OF_MARKDOWN]
        };
    }
}