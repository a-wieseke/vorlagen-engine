"""Target-account authorization. Never infer administrator status from a name."""
import json


def is_system_admin(user):
    return bool(user and user["role_system"] and user["role_name"] == "Administrator")


def target_error(actor, target, permissions):
    if not target:
        return "Benutzer wurde nicht gefunden."
    if is_system_admin(actor):
        return None
    if is_system_admin(target) or not set(permissions(target)).issubset(permissions(actor)):
        return "Dieses Konto besitzt weitergehende Rechte und darf nur durch eine entsprechend berechtigte Administration verwaltet werden."
    # Category grants are privileges too; a delegated manager must not take
    # control of accounts with access to additional mail categories.
    if target["all_categories"] and not actor["all_categories"]:
        return "Das Zielkonto besitzt weitergehenden Zugriff auf Mailkategorien."
    return None


def role_error(actor, role, permissions, conn=None):
    if not role:
        return "Die ausgewählte Rolle existiert nicht."
    if is_system_admin(actor):
        return None
    if (role["is_system"] and role["name"] == "Administrator") or not set(json.loads(role["permissions_json"])).issubset(permissions(actor)):
        return "Sie dürfen keine Rolle mit weitergehenden Berechtigungen zuweisen."
    if not actor["all_categories"]:
        if role["all_categories"]:
            return "Diese Rolle gewährt weitergehenden Zugriff auf Mailkategorien."
        if conn is not None:
            grants=lambda rid: {r[0] for r in conn.execute("SELECT category_id FROM role_categories WHERE role_id=?",(rid,))}
            if not grants(role["id"]).issubset(grants(actor["role_id"])):
                return "Diese Rolle gewährt weitergehenden Zugriff auf Mailkategorien."


def grant_error(conn, actor, payload, permissions, existing=None):
    """Role editors are delegated capabilities, not implicit superusers."""
    if is_system_admin(actor):return None
    if existing:
        error=role_error(actor,existing,permissions,conn)
        if error:return error
    if not set(payload['permissions']).issubset(permissions(actor)):
        return "Eine Rolle darf keine weitergehenden Berechtigungen erhalten als Ihr Konto."
    if not actor['all_categories']:
        granted={r[0] for r in conn.execute('SELECT category_id FROM role_categories WHERE role_id=?',(actor['role_id'],))}
        if payload['all_categories'] or not set(payload['category_ids']).issubset(granted):
            return "Eine Rolle darf keinen weitergehenden Zugriff auf Mailkategorien erhalten."
    return None
