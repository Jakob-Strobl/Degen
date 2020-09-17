import { parse as parseToml } from "https://deno.land/std@0.69.0/encoding/toml.ts"; 
import { ensureDirSync } from "https://deno.land/std@0.69.0/fs/mod.ts"
import * as Degen from "./lib.ts";
import { Pages } from "./pages.ts";


export module Util {    
    export let config: Degen.ProjectConfig | null = null;

    export function createError(error_code: Degen.ErrorCode, filename: string, msg: string) {
        return Error(`ERROR [${error_code}]: In '${filename}', ${msg}`);
    }

    export async function readFile(absolute_path: string) : Promise<string> {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(await Deno.readFile(absolute_path));
    }

    export async function writePage(utf8: string, page: Pages.Page ) {
        const export_dir = page.getExportDir();
        const export_path = page.get('export_path');
        ensureDirSync(export_dir);
        console.log(`writing file to: ${export_path}`);

        const encoder = new TextEncoder();
        const data = encoder.encode(utf8);
        await Deno.writeFile(export_path, data);
    }

    export function getSetOfAllPageEntries(directory_paths: Array<string>) {
        let page_entries = new Set<string>();
        directory_paths = directory_paths.map((dir) => Deno.realPathSync(dir));
    
        // Find all child directories of the source paths
        for (const directory of directory_paths) {
            const entries = [...Deno.readDirSync(directory)]; // decompose iterator into an array 
    
            // Seperate directories and pages
            const dir_entries = entries.filter((entry: Deno.DirEntry) => entry.isDirectory);
            const dir_paths = dir_entries.map((dir: Deno.DirEntry) => Deno.realPathSync(`${directory}/${dir.name}`));
    
            const file_entries = entries.filter((entry: Deno.DirEntry) => entry.isFile && entry.name.match(/.md/i));
            const file_paths = file_entries.map((page: Deno.DirEntry) => Deno.realPathSync(`${directory}/${page.name}`));
    
            // Recurse 
            if (dir_entries.length > 0) {
                const child_paths = getSetOfAllPageEntries(dir_paths);
                for (const path of child_paths) {
                    page_entries.add(path);
                }
            }
    
            // Add current directories pages - Union the sets
            for (const path of file_paths) {
                page_entries.add(path);
            }
        }
    
        return page_entries;
    }

    export async function getStatisTomlConfig(path: string) : Promise<Degen.ProjectConfig> {
        if (!config)
            config = <Degen.ProjectConfig> <unknown> parseToml(await Util.readFile(path));
            
        return config;
    }
}