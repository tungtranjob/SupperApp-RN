import React from 'react';
import { SduiNode } from './types';
import { registry, UnknownComponent } from './registry';
import { bind, evalExpr, truthy, BindContext } from './bind';
import { ActionRuntime, runActions } from './actions';

/**
 * RENDERER — biến cây JSON thành cây React element.
 *
 * Thứ tự xử lý:
 *   1. repeat  → được MỞ RỘNG NGAY Ở CẤP CHA (renderNodes), không bọc trong Fragment.
 *                Quan trọng: component như <Grid> đếm children bằng React.Children.toArray,
 *                mà hàm này KHÔNG mở Fragment — nếu bọc Fragment thì cả danh sách
 *                sẽ bị nhồi vào đúng 1 ô của lưới.
 *   2. if      → bỏ qua nếu điều kiện falsy
 *   3. props   → resolve binding
 *   4. type    → tra registry; không có thì render UnknownComponent (không crash)
 */

export type RenderProps = {
  node: SduiNode;
  rt: ActionRuntime;
  /** biến cục bộ sinh ra từ repeat: { svc: {...}, index: 0 } */
  scope?: BindContext;
};

/** Render một danh sách node thành MẢNG PHẲNG các element. */
export function renderNodes(
  nodes: SduiNode[] | undefined,
  rt: ActionRuntime,
  scope: BindContext = {},
): React.ReactNode[] {
  if (!nodes?.length) return [];
  const out: React.ReactNode[] = [];

  nodes.forEach((node, i) => {
    if (node.repeat) {
      const ctx = rt.buildContext(scope);
      const raw = evalExpr(node.repeat.items, ctx);
      const items: any[] = Array.isArray(raw) ? raw : [];
      const alias = node.repeat.as || 'item';
      const { repeat, ...rest } = node;

      items.forEach((item, index) => {
        out.push(
          <RenderNode
            key={`${i}:${item?.id ?? index}`}
            node={rest as SduiNode}
            rt={rt}
            scope={{ ...scope, [alias]: item, index }}
          />,
        );
      });
    } else {
      out.push(<RenderNode key={i} node={node} rt={rt} scope={scope} />);
    }
  });

  return out;
}

export const RenderNode: React.FC<RenderProps> = ({ node, rt, scope = {} }) => {
  // Node gốc cũng có thể có repeat → ủy quyền cho renderNodes.
  if (node.repeat) return <>{renderNodes([node], rt, scope)}</>;

  const ctx = rt.buildContext(scope);

  if (!truthy(node.if, ctx)) return null;

  const p = bind(node.props ?? {}, ctx);

  const Comp = registry[node.type];
  if (!Comp) return <UnknownComponent type={node.type} />;

  const on = (event: string, payload?: Record<string, any>) => {
    const actions = node.actions?.[event];
    if (!actions?.length) return;
    // scope (biến từ repeat) + payload của sự kiện được truyền vào chuỗi action
    void runActions(actions, rt, { ...scope, event: payload ?? {} });
  };
  const has = (event: string) => Boolean(node.actions?.[event]?.length);

  const children = node.children?.length ? renderNodes(node.children, rt, scope) : undefined;

  return (
    <Comp p={p} on={on} has={has}>
      {children}
    </Comp>
  );
};
