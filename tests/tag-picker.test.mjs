import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// 本番のコンポーネントをそのまま描画。テスト用の代替UIは作らない。
const root = new URL('../', import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/lib/')) return next(new URL(specifier.slice(2) + '.ts', root).href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  },
});
const { TagPicker } = await import('../components/journal/shared.tsx');
hooks.deregister();
const catalog = { revision: 0, groups: ['生活', '未分類'], tags: ['睡眠', '散歩', '非表示'].map((name, i) => ({
  name, group: '生活', quantified: false, unit: '', archived: i === 2,
})) };
const props = { all: [], value: [], onChange() {}, onAdd() {}, onToggle() {}, catalog, usage: { 睡眠: 2, 散歩: 10, 非表示: 99 } };
const render = (expanded, extra = {}) => renderToStaticMarkup(createElement(TagPicker, {
  ...props, expanded, expandedContent: createElement('input', { 'aria-label': '投稿の日時' }), ...extra,
}));

test('タグ選択: 最近タグを出さず、頻度順の候補を開閉前後で保持する', () => {
  for (const expanded of [false, true]) {
    const html = render(expanded);
    assert(!html.includes('最近使ったタグ'));
    assert(html.indexOf('散歩を追加') < html.indexOf('睡眠を追加'));
    assert(!html.includes('非表示を追加'));
    assert(html.includes('aria-label="よく使うタグ"'));
  }
});

test('タグ選択: 上下の開閉ボタンは同じ領域と展開状態を示す', () => {
  for (const expanded of [false, true]) {
    const html = render(expanded);
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(m => m[1]);
    assert.equal(controls.length, expanded ? 2 : 1);
    if (expanded) assert.equal(controls[0], controls[1]);
    assert(html.includes('id="' + controls[0] + '"'));
    assert.equal([...html.matchAll(new RegExp('aria-expanded="' + expanded + '"', 'g'))].length, expanded ? 2 : 1);
    assert.equal(html.includes('下からタグ・日時を閉じる'), expanded);
    assert(!html.includes('下からタグ・日時を開く'));
    assert.equal(html.includes('tag-disclosure-bottom'), expanded);
    assert.equal(html.includes('グループ別のタグ'), expanded);
    assert.equal(html.includes('投稿の日時'), expanded);
  }
});

test('タグ選択: 上の開閉は展開領域より前、下の矢印は領域と今回タグより後', () => {
  const html = render(true, { value: ['睡眠'], quantities: { 睡眠: 2 }, onQuantities() {} });
  assert(html.indexOf('tag-disclosure-heading') < html.indexOf('tag-expanded-content'));
  assert(html.indexOf('tag-expanded-content') < html.indexOf('今回のタグ'));
  assert(html.indexOf('今回のタグ') < html.indexOf('下からタグ・日時を閉じる'));
  assert(html.includes('value="2"'));
});

test('タグ選択: 利用履歴がなくても初期候補、編集時は常時展開できる', () => {
  const html = render(true, { usage: {}, onToggle: undefined });
  assert(html.includes('よく使うタグ'));
  assert(html.includes('睡眠を追加'));
  assert(html.includes('グループ別のタグ'));
  assert(!html.includes('下からタグ・日時'));
});
