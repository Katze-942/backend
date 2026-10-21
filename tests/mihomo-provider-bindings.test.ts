import assert from 'node:assert/strict';
import { test } from 'node:test';

import { finalizeMihomoProviderBindings } from '../src/modules/subscription-template/generators/mihomo-provider-bindings';

type Config = Record<string, unknown>;
type Node = Config & { name: string };

const node = (name: string, uuid = 'fixture-user'): Node => ({
    name,
    type: 'vless',
    server: 'fixture.invalid',
    port: 443,
    uuid,
});

function fixture(nodes: Node[] = [node('A'), node('B')]) {
    const template: Config = {
        remnawave: { 'known-proxy-names': ['A', 'B', 'Unbound'] },
        'proxy-providers': {
            a: { remnawave: { 'include-proxies': true, 'include-proxy-names': ['A'] } },
            b: { remnawave: { 'include-proxies': true, 'include-proxy-names': ['B'] } },
        },
    };
    // Shape produced by the existing generator before provider binding completion.
    const rendered: Config = {
        proxies: [{ name: 'Jump', type: 'rematch', 'target-sub-rule': 'B' }, ...nodes],
        'proxy-providers': { a: { payload: nodes }, b: { payload: nodes } },
        'proxy-groups': [
            { name: 'A', type: 'select', use: ['a'], proxies: [] },
            { name: 'B', type: 'select', use: ['b'], proxies: [] },
            { name: 'Main', type: 'fallback', use: ['a', 'b'], proxies: ['Jump'] },
            { name: 'Only B', type: 'url-test', use: ['b'], proxies: [] },
            { name: 'Pick', type: 'select', proxies: ['A', 'B'], 'default-selected': 'B' },
            { name: 'GLOBAL', type: 'select', proxies: ['DIRECT', 'A', 'B', 'Jump', 'Unbound'] },
        ],
        rules: ['SUB-RULE,(DST-PORT,0-65535),B', 'IP-CIDR,192.0.2.0/24,B,no-resolve', 'MATCH,A'],
        'sub-rules': { B: ['MATCH,B'] },
    };
    return { rendered, template, nodes };
}

const groups = (config: Config) => config['proxy-groups'] as Config[];
const group = (config: Config, name: string) => groups(config).find((g) => g.name === name)!;
const providers = (config: Config) => config['proxy-providers'] as Record<string, Config>;

test('legacy templates pass through unchanged, including object identity', () => {
    const { rendered, nodes } = fixture();
    const template = { 'proxy-providers': { all: { remnawave: { 'include-proxies': true } } } };
    assert.equal(finalizeMihomoProviderBindings(rendered, template, nodes), rendered);
});

test('each provider receives only its bound node and top-level duplicates are removed', () => {
    const { rendered, template, nodes } = fixture();
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.deepEqual(providers(out).a.payload, [nodes[0]]);
    assert.deepEqual(providers(out).b.payload, [nodes[1]]);
    assert.deepEqual(out.proxies, [{ name: 'Jump', type: 'rematch', 'target-sub-rule': 'B' }]);
    assert.deepEqual(group(out, 'GLOBAL').proxies, ['DIRECT', 'A', 'B', 'Jump']);
});

test('the same cached template uses the current user credentials on every render', () => {
    const { rendered, template } = fixture();
    const before = structuredClone({ rendered, template });
    for (const uuid of ['user-one', 'user-two']) {
        const nodes = [node('A', uuid)];
        const input = {
            ...rendered,
            proxies: [
                ...(rendered.proxies as Node[]).filter((proxy) => proxy.name === 'Jump'),
                ...nodes,
            ],
        };
        const out = finalizeMihomoProviderBindings(input, template, nodes);
        assert.deepEqual(providers(out).a.payload, nodes);
        assert.equal(providers(out).b, undefined);
    }
    assert.deepEqual({ rendered, template }, before);
});

test('missing nodes prune providers and aliases, and preserve fail-closed routing', () => {
    const { rendered, template, nodes } = fixture([node('A')]);
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.equal(providers(out).b, undefined);
    assert.equal(group(out, 'B'), undefined);
    assert.deepEqual(group(out, 'Main').use, ['a']);
    assert.deepEqual(group(out, 'Only B'), {
        name: 'Only B',
        type: 'url-test',
        proxies: ['REJECT'],
        'empty-fallback': 'REJECT',
    });
    assert.deepEqual(group(out, 'Pick').proxies, ['A', 'REJECT']);
    assert.equal(group(out, 'Pick')['default-selected'], undefined);
    assert.deepEqual(out.rules, [
        'SUB-RULE,(DST-PORT,0-65535),B',
        'IP-CIDR,192.0.2.0/24,REJECT,no-resolve',
        'MATCH,A',
    ]);
    assert.deepEqual(out['sub-rules'], { B: ['MATCH,REJECT'] });
});

test('an empty user node set produces rejecting groups and rules', () => {
    const { rendered, template, nodes } = fixture([]);
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.deepEqual(providers(out), {});
    assert.deepEqual(group(out, 'Pick').proxies, ['REJECT', 'REJECT']);
    assert.deepEqual(group(out, 'GLOBAL').proxies, ['DIRECT', 'Jump']);
    assert.equal((out.rules as string[]).at(-1), 'MATCH,REJECT');
});

test('unbound generated nodes stay available and are added to GLOBAL once', () => {
    const { rendered, template, nodes } = fixture([node('A'), node('B'), node('New')]);
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.deepEqual(
        (out.proxies as Node[]).map((p) => p.name),
        ['Jump', 'New'],
    );
    assert.deepEqual(group(out, 'GLOBAL').proxies, ['DIRECT', 'A', 'B', 'Jump', 'New']);
});

test('explicit selection of an available provider-only node is retained', () => {
    const { rendered, template, nodes } = fixture();
    rendered['proxy-groups'] = [
        { name: 'Pick', type: 'select', use: ['a'], 'default-selected': 'A' },
    ];
    rendered.rules = ['MATCH,Pick'];
    rendered['sub-rules'] = {};
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.equal(group(out, 'Pick')['default-selected'], 'A');
});

test('binding order is retained and repeated names are deduplicated', () => {
    const { rendered, template, nodes } = fixture();
    const source = (template['proxy-providers'] as Record<string, Config>).a;
    (source.remnawave as Config)['include-proxy-names'] = ['B', 'A', 'B'];
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    assert.deepEqual(
        (providers(out).a.payload as Node[]).map((p) => p.name),
        ['B', 'A'],
    );
});

test('binding output does not share mutable proxy objects with generated nodes', () => {
    const { rendered, template, nodes } = fixture();
    const out = finalizeMihomoProviderBindings(rendered, template, nodes);
    (providers(out).a.payload as Node[])[0].uuid = 'changed';
    assert.equal(nodes[0].uuid, 'fixture-user');
});

test('invalid binding directives fail rather than exposing all nodes in a provider', () => {
    for (const value of [[], 'A', [null], [12], ['']]) {
        const { rendered, template, nodes } = fixture();
        const source = (template['proxy-providers'] as Record<string, Config>).a;
        (source.remnawave as Config)['include-proxy-names'] = value;
        assert.throws(
            () => finalizeMihomoProviderBindings(rendered, template, nodes),
            /nonempty array/,
        );
    }
    const { rendered, template, nodes } = fixture();
    const source = (template['proxy-providers'] as Record<string, Config>).a;
    (source.remnawave as Config)['include-proxies'] = false;
    assert.throws(() => finalizeMihomoProviderBindings(rendered, template, nodes), /requires/);
});

test('unknown proxy references remain template errors', () => {
    const { rendered, template, nodes } = fixture();
    rendered.rules = ['MATCH,typo'];
    assert.throws(() => finalizeMihomoProviderBindings(rendered, template, nodes), /Unknown.*typo/);
});

test('invalid known-proxy-names is reported', () => {
    const { rendered, template, nodes } = fixture();
    template.remnawave = { 'known-proxy-names': 'A' };
    assert.throws(
        () => finalizeMihomoProviderBindings(rendered, template, nodes),
        /nonempty array/,
    );
});
