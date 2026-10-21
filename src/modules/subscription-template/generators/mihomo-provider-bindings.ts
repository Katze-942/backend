type Config = Record<string, unknown>;
type ProxyNode = Config & { name: string };
type Provider = Config & { payload?: ProxyNode[]; remnawave?: Config };
type Group = Config & { name: string; type: string; proxies?: string[]; use?: string[] };

const BUILTIN_PROXIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL'];

function proxyNames(value: unknown, field: string): string[] {
    if (
        !Array.isArray(value) ||
        !value.length ||
        !value.every((name): name is string => typeof name === 'string' && name.length > 0)
    ) {
        throw new Error(`${field} must be a nonempty array of proxy names`);
    }
    return [...new Set(value)];
}

/** Resolve opt-in provider bindings using only this subscription's generated nodes. */
export function finalizeMihomoProviderBindings(
    rendered: Config,
    template: Config,
    generatedProxies: ProxyNode[],
): Config {
    const sourceProviders = (template['proxy-providers'] ?? {}) as Record<string, Provider>;
    const bindings = Object.entries(sourceProviders).filter(
        ([, provider]) =>
            provider.remnawave && Object.hasOwn(provider.remnawave, 'include-proxy-names'),
    );
    // Preserve legacy rendering, including object identity and YAML aliases.
    if (!bindings.length) return rendered;

    const out = structuredClone(rendered);
    const providers = out['proxy-providers'] as Record<string, Provider>;
    const actual = new Map(generatedProxies.map((proxy) => [proxy.name, proxy]));
    const moved = new Set<string>();
    const absentProviders = new Set<string>();
    const boundNames = new Set<string>();

    for (const [key, source] of bindings) {
        if (source.remnawave?.['include-proxies'] !== true) {
            throw new Error(`Provider ${key}: include-proxy-names requires include-proxies: true`);
        }
        const names = proxyNames(
            source.remnawave['include-proxy-names'],
            `Provider ${key}: include-proxy-names`,
        );
        names.forEach((name) => boundNames.add(name));
        const payload = names.flatMap((name) => {
            const proxy = actual.get(name);
            return proxy ? [structuredClone(proxy)] : [];
        });

        if (payload.length) {
            providers[key].payload = payload;
            payload.forEach((proxy) => moved.add(proxy.name));
        } else {
            // An empty inline provider makes Mihomo reject the entire configuration.
            delete providers[key];
            absentProviders.add(key);
        }
    }

    out.proxies = (out.proxies as ProxyNode[]).filter((proxy) => !moved.has(proxy.name));
    const removedAliases = new Set<string>();
    const groups = (out['proxy-groups'] as Group[]).filter((group) => {
        if (
            group.type === 'select' &&
            group.use?.length === 1 &&
            absentProviders.has(group.use[0]) &&
            boundNames.has(group.name) &&
            !group.proxies?.length
        ) {
            removedAliases.add(group.name);
            return false;
        }
        return true;
    });
    out['proxy-groups'] = groups;

    const root = template.remnawave as Config | undefined;
    const declaredNames = root?.['known-proxy-names'];
    const knownTemplateNodes = new Set(
        declaredNames === undefined ? [] : proxyNames(declaredNames, 'remnawave.known-proxy-names'),
    );
    const known = new Set([
        ...BUILTIN_PROXIES,
        ...(out.proxies as ProxyNode[]).map((proxy) => proxy.name),
        ...groups.map((group) => group.name),
    ]);
    const unavailable = (name: string): boolean =>
        removedAliases.has(name) ||
        ((knownTemplateNodes.has(name) || boundNames.has(name)) && !actual.has(name));
    const resolve = (name: string): string => {
        if (known.has(name)) return name;
        if (unavailable(name)) return 'REJECT';
        throw new Error(`Unknown Mihomo proxy reference: ${name}`);
    };

    for (const group of groups) {
        const oldUse = group.use ?? [];
        if (group.use) group.use = oldUse.filter((name) => !absentProviders.has(name));
        if (group.proxies) {
            group.proxies =
                group.name === 'GLOBAL'
                    ? group.proxies.filter((name) => {
                          if (known.has(name)) return true;
                          if (unavailable(name)) return false;
                          resolve(name);
                          return false;
                      })
                    : group.proxies.map(resolve);
        }
        if (oldUse.length && !group.use?.length && !group.proxies?.length) {
            group['empty-fallback'] = 'REJECT';
            group.proxies = ['REJECT'];
            delete group.use;
        }
        const selected = group['default-selected'];
        if (typeof selected === 'string' && unavailable(selected)) {
            delete group['default-selected'];
        }
        if (typeof group['empty-fallback'] === 'string') {
            group['empty-fallback'] = resolve(group['empty-fallback']);
        }
    }

    const global = groups.find((group) => group.name === 'GLOBAL');
    if (global) {
        global.proxies ??= [];
        for (const proxy of generatedProxies) {
            if (!global.proxies.includes(proxy.name)) global.proxies.push(proxy.name);
        }
    }
    const rewriteRules = (rows: string[]): string[] =>
        rows.map((row) => {
            const parts = row.split(',');
            if (parts[0] === 'SUB-RULE') return row;
            const index = parts.at(-1) === 'no-resolve' ? parts.length - 2 : parts.length - 1;
            parts[index] = resolve(parts[index]);
            return parts.join(',');
        });
    out.rules = rewriteRules((out.rules ?? []) as string[]);
    const subRules = out['sub-rules'] as Record<string, string[]> | undefined;
    for (const key of Object.keys(subRules ?? {})) {
        subRules![key] = rewriteRules(subRules![key]);
    }
    delete out.remnawave;
    return out;
}
