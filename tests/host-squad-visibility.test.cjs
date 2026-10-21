const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { Kysely, SqliteDialect } = require('kysely');

const root = path.resolve(__dirname, '..');
const constants = {
    INTERNAL_SQUADS_MODE: { ALLOW_ONLY: 'ALLOW_ONLY', EXCLUDE: 'EXCLUDE' },
    RESPONSE_RULES_RESPONSE_TYPES: {},
};
const nest = { Injectable: () => (target) => target, Logger: class {} };

// Load the actual repository/middleware without booting Nest or connecting to production.
function load(relative, mocks) {
    const filename = path.join(root, relative);
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true,
        },
        fileName: filename,
    });
    const module = { exports: {} };
    vm.runInNewContext(
        outputText,
        {
            module,
            exports: module.exports,
            require: (name) => {
                if (name === '@nestjs/common') return nest;
                if (name === '@libs/contracts/constants') return constants;
                if (Object.hasOwn(mocks, name)) return mocks[name];
                throw new Error(`Unexpected dependency: ${name}`);
            },
        },
        { filename },
    );
    return module.exports;
}

const { HostsRepository } = load('src/modules/hosts/repositories/hosts.repository.ts', {
    kysely: require('kysely'),
    '@common/helpers': {},
    '@common/helpers/kysely/values': {},
});

async function visible(ignore, userId = 1, returnDisabled = false, returnHidden = false) {
    const db = new DatabaseSync(':memory:');
    db.exec(`
        CREATE TABLE hosts (uuid TEXT, configProfileInboundUuid TEXT,
            internalSquadsMode TEXT, isDisabled INTEGER, isHidden INTEGER, viewPosition INTEGER);
        CREATE TABLE internalSquadInbounds (internalSquadUuid TEXT, inboundUuid TEXT);
        CREATE TABLE internalSquadMembers (internalSquadUuid TEXT, userId INTEGER);
        CREATE TABLE internalSquadHostLinks (hostUuid TEXT, squadUuid TEXT);
        INSERT INTO internalSquadMembers VALUES ('stupid', 1), ('other', 2), ('extra', 3), ('stupid', 3);
        INSERT INTO internalSquadInbounds VALUES ('stupid', 'allowed'), ('extra', 'allowed'), ('other', 'restricted');
        INSERT INTO hosts VALUES
            ('public', 'allowed', 'EXCLUDE', 0, 0, 1),
            ('excluded', 'allowed', 'EXCLUDE', 0, 0, 2),
            ('allow-only-other', 'allowed', 'ALLOW_ONLY', 0, 0, 3),
            ('allow-only-stupid', 'allowed', 'ALLOW_ONLY', 0, 0, 4),
            ('unauthorized', 'restricted', 'EXCLUDE', 0, 0, 5),
            ('disabled', 'allowed', 'EXCLUDE', 1, 0, 6),
            ('hidden', 'allowed', 'EXCLUDE', 0, 1, 7);
        INSERT INTO internalSquadHostLinks VALUES
            ('excluded', 'stupid'), ('allow-only-other', 'other'), ('allow-only-stupid', 'stupid');
    `);
    const qb = new Kysely({ dialect: new SqliteDialect({ database: {} }) });
    // Compile the real Kysely query, then execute it against an isolated SQLite database.
    const connection = {
        selectFrom: (...args) => {
            const query = qb.selectFrom(...args);
            const wrap = (builder) =>
                new Proxy(builder, {
                    get(target, key) {
                        if (key === 'execute')
                            return async () => {
                                const compiled = target.compile();
                                const params = compiled.parameters.map((p) =>
                                    typeof p === 'boolean' ? Number(p) : p,
                                );
                                return db.prepare(compiled.sql).all(...params);
                            };
                        const value = target[key];
                        return typeof value === 'function'
                            ? (...args) => wrap(value.apply(target, args))
                            : value;
                    },
                });
            return wrap(query);
        },
    };
    try {
        const repository = new HostsRepository({}, { kysely: connection }, {});
        return (
            await repository.findActiveHostsByUserId(
                BigInt(userId),
                returnDisabled,
                returnHidden,
                ignore,
            )
        ).map((host) => host.uuid);
    } finally {
        db.close();
    }
}

test('default and explicit false preserve squad visibility restrictions', async () => {
    assert.deepEqual(await visible(undefined), ['public', 'allow-only-stupid']);
    assert.deepEqual(await visible(false), ['public', 'allow-only-stupid']);
});

test('opt-in bypasses EXCLUDE and ALLOW_ONLY while retaining inbound authorization', async () => {
    assert.deepEqual(await visible(true), [
        'public',
        'excluded',
        'allow-only-other',
        'allow-only-stupid',
    ]);
});

test('opt-in never exposes another squad inbound or grants access to a user without memberships', async () => {
    assert.deepEqual(await visible(true, 2), ['unauthorized']);
    assert.deepEqual(await visible(true, 999), []);
});

test('disabled and hidden host flags remain independent of squad visibility', async () => {
    assert.deepEqual(await visible(true, 1, true, false), [
        'public',
        'excluded',
        'allow-only-other',
        'allow-only-stupid',
        'disabled',
    ]);
    assert.deepEqual(await visible(true, 1, false, true), [
        'public',
        'excluded',
        'allow-only-other',
        'allow-only-stupid',
        'hidden',
    ]);
});

test('multiple squad memberships retain existing union semantics without duplicate hosts', async () => {
    assert.deepEqual(await visible(false, 3), ['public', 'excluded', 'allow-only-stupid']);
    assert.deepEqual(await visible(true, 3), [
        'public',
        'excluded',
        'allow-only-other',
        'allow-only-stupid',
    ]);
});

const { ResponseRuleModificationsSchema } = load(
    'libs/contract/models/response-rules/response-rule-modifications.schema.ts',
    { zod: require('zod') },
);

test('response rule schema accepts only boolean opt-in and preserves legacy modifications', () => {
    assert.deepEqual(ResponseRuleModificationsSchema.parse({}), {});
    for (const value of [true, false]) {
        assert.equal(
            ResponseRuleModificationsSchema.parse({ ignoreHostInternalSquadRestrictions: value })
                .ignoreHostInternalSquadRestrictions,
            value,
        );
    }
    assert.equal(
        ResponseRuleModificationsSchema.safeParse({ ignoreHostInternalSquadRestrictions: 'true' })
            .success,
        false,
    );
});

const { ResponseRulesMiddleware } = load(
    'src/modules/subscription-response-rules/middleware/response-rules.middleware.ts',
    {
        '@common/exception/http-exeception-with-error-code.type': {},
        '@common/utils/extract-hwid-headers/extract-hwid-headers.util': {
            extractHwidHeaders: () => null,
        },
        '@common/utils/truncate-header.util': { truncateHeader: (value) => value },
        '@modules/subscription-settings/queries/get-cached-subscrtipion-settings': {
            GetCachedSubscriptionSettingsQuery: class {},
        },
        '@modules/subscription-template/constants': { isExtendedClient: () => false },
    },
);

test('middleware forwards only the matched rule opt-in without leaking it across requests', async () => {
    let modifications = { ignoreHostInternalSquadRestrictions: true };
    const middleware = new ResponseRulesMiddleware(
        { execute: async () => ({ responseRules: {} }) },
        {
            matchRules: () => ({
                matched: true,
                responseType: 'MIHOMO',
                matchedRule: { responseModifications: modifications },
            }),
        },
    );
    for (const enabled of [true, false, undefined]) {
        modifications =
            enabled === undefined ? {} : { ignoreHostInternalSquadRestrictions: enabled };
        const req = {
            headers: { 'user-agent': 'Mihomo/fixture' },
            params: { shortUuid: 'fixture' },
            clientIp: '127.0.0.1',
        };
        let called = false;
        await middleware.use(req, { setHeader() {} }, (error) => {
            assert.equal(error, undefined);
            called = true;
        });
        assert.equal(called, true);
        assert.equal(
            req.srrContext.ignoreHostInternalSquadRestrictions,
            enabled === true ? true : undefined,
        );
    }
});
