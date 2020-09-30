import * as Degen from "./lib.ts"; 
import { Util } from "./util.ts";
import { Pages } from "./pages.ts";

// Template Errors
export class TemplateError extends Degen.DegenError {
    constructor(error_code: string, msg: string, page: Degen.DegenPath, template: Degen.DegenPath) {
        super(error_code, msg, `${page.full_path} via ${template.full_path}`);
        this.name = "TemplateError";
    }
}

export class TemplateVariableUndefined extends TemplateError {
    constructor(template_variable: string, page: Degen.DegenPath, template: Degen.DegenPath) {
        super("T200", `Template Variable '${template_variable}', binds to an undefined property`, page, template);
        this.name = "TemplateVariableUndefined";
    }
}

export class TemplateExpressionRuntimeError extends TemplateError {
    constructor(runtime_error: Error, page: Degen.DegenPath, template: Degen.DegenPath) {
        super(
            "T301", 
            `Error thrown during template expression runtime:\n[[  ${runtime_error}  ]]`,
            page,
            template
        );
        this.name = "TemplateExpressionRuntimeError";
    }
}

export interface TempleConfig {
    template_variable_decleration: RegExp;
    template_expression_decleration: RegExp;
    expression: RegExp;
}

// Temple - Template Engine
export module Temple {
    const regexs: TempleConfig = {
        template_variable_decleration: /!{(?!\{)\s*(\w+)(\..+?)?\s*}/g,
        template_expression_decleration: /\!{{((\r|\n|.)+?)}}/g,
        expression: /^(?<collection>\w+)([^.]*)?\.(?<func>((\n|\r|.)*))/,
    }

    async function readInTemplate(path: Degen.DegenPath) : Promise<string>  {
        return await Util.readFile(path);
    }

    /**
     * render a template string using a Page and the Compendium 
     * @param template      the template we are using to render (may contain template variables and template expressions)
     * @param page          The current page we are rendering with
     * @param compendium    access to all other PageCollections if needed (used in template expressions)
     */
    export function renderString(template: string, page: Pages.Page, compendium: Pages.Compendium)  {
        function render(page: Pages.Page) {
            /**
             * parse and evaluate template variables in the template string and match to properties in the given Page context 
             * @param match     unused
             * @param variable  match to variable name
             * @param calls     function calls used on the matched variable 
             * @returns serializeable data that matches the variable 
             * @throws TemplateVairableUndefined if the variable does not match to a Page Property 
             */
            function parseTemplateVariables(match: any, variable: string, calls?: string) : string {
                variable = variable.trim();
                if (variable in page.getData()) {
                    const var_data = page.get(variable);
                    if (calls) {
                        // If there are functions called, execute the functions on the variable
                        const renderVariableExpression = new Function(
                            "variable",
                            `return variable${calls};`
                        );
                        return renderVariableExpression(var_data);
                    } else {
                        return var_data;
                    }
                } else { 
                    throw new TemplateVariableUndefined(variable, page.get('path'), page.get('template'));
                }
            }

            /**
             * Parse and evaluate template expressions
             * @param match unused
             * @param expr1 the template expression we want to match and evaluate 
             */
            function parseTemplateExpressions(match: any, expr1: string) {
                let expr = expr1.trim();

                // Parse the expression into groups
                const expr_regex = regexs.expression;
                const m = expr.match(expr_regex);
                if (!m || !m.groups) {
                    throw new TemplateError(
                        "T300",
                        "Template Expression Regex did not match for named groups",
                        page.get('path'),
                        page.get('template')
                    );
                }

                // Create dynamic function to execute
                const collection = m.groups.collection;
                const funcs = m.groups.func; 
                const renderExpression = new Function(
                    "compendium",
                    "collection",
                    "current_page", 
                    `return compendium.get(collection).${funcs};`
                );
                
                // Call dynamic function to render
                try {
                    const out : string = renderExpression(compendium, collection, page);
                    return out;
                } catch (e) {
                    throw new TemplateExpressionRuntimeError(e, page.get('path'), page.get('template'));
                }
            }

            let output = template;
            // Parse template variables 
            output = output.replace(regexs.template_variable_decleration, parseTemplateVariables);
            // Parse template expressions
            output = output.replace(regexs.template_expression_decleration, parseTemplateExpressions);

            return output;
        }
        return render(page);
    }

    /**
     * Render a Page (get's tamplate via page property)
     * @param page The current page context for rendering (i.e. the page we want to render)
     * @param compendium The compendium we are using for access to PageCollections
     */
    export async function render(page: Pages.Page, compendium: Pages.Compendium) {
        const template = await readInTemplate(page.get('template')); 
        return renderString(template, page, compendium);
    }
}