import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { parse as parseToml } from "https://deno.land/std@0.69.0/encoding/toml.ts"; 
import { ensureDirSync } from "https://deno.land/std@0.69.0/fs/mod.ts"

import * as Degen from "./lib.ts";
import { Pages } from "./pages.ts";

export module Util {    
    let config: Degen.ProjectConfig | null = null;

    /**
     * Read file in by its path
     * @param path 
     */
    export async function readFile(path: Degen.DegenPath) : Promise<string> {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(await Deno.readFile(path.full_path));
    }

    /**
     * Write a file by its path,
     * @param utf8 the content to render 
     * @param page The page we want to write (used to get export path)
     * @param degen_settings set log level via project config 
     */
    export async function writePage(utf8: string, page: Pages.Page, degen_settings: Degen.DegenSettings) {
        const export_path = <Degen.DegenPath> page.get('export_path');
        ensureDirSync(export_path.dir);
        if (degen_settings.log_write_rendered_html) {
            console.log(`writing file to: ${export_path.file} via ${export_path.dir}`);
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(utf8);
        await Deno.writeFile(export_path.full_path, data);
    }

    /**
     * Recursive function that finds a set of all markdown files inside directories and their child directories 
     * @param directory_paths directories we want to search through 
     */
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

    /**
     * Get the project config asynchronously 
     * @param path path to project config  
     * @throws DegenError if config is not found and no path is given 
     */
    export async function getProjectConfig(path?: Degen.DegenPath) : Promise<Degen.ProjectConfig> {
        if (!config) {
            if (!path) {
                throw new Degen.DegenError(
                    "U100",
                    "Project config does not exist and no path was given",
                    path);
            } else {
                config = <Degen.ProjectConfig> <unknown> parseToml(await Util.readFile(path));
            }
        }
            
        return config;
    }
    
    /**
     * Get the project config synchronously 
     * @throws DegenError if project config has not been opened
     */
    export function getProjectConfigSync() {
        if (!config) {
            throw new Degen.DegenError(
                "U101",
                "Project config does not exist");
        }
    
        return config;
    }
}