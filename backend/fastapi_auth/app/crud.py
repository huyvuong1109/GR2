from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models
from .auth import hash_password, verify_password
from datetime import datetime

def create_user(db: Session, email: str, username: str, password: str):
    pw_hash = hash_password(password)
    user = models.User(email=email, username=username, password_hash=pw_hash)
    db.add(user); db.commit(); db.refresh(user)
    return user

def get_user_by_username_or_email(db: Session, identifier: str):
    return db.query(models.User).filter((models.User.username==identifier)|(models.User.email==identifier)).first()

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id==user_id).first()

def verify_user_credentials(db: Session, identifier: str, password: str):
    user = get_user_by_username_or_email(db, identifier)
    if not user: return None
    if not verify_password(password, user.password_hash): return None
    return user

# Watchlist
def add_watchlist(db: Session, user_id: int, ticker: str):
    existing = db.query(models.Watchlist).filter(models.Watchlist.user_id==user_id, models.Watchlist.ticker==ticker).first()
    if existing: return existing
    item = models.Watchlist(user_id=user_id, ticker=ticker)
    db.add(item); db.commit(); db.refresh(item)
    return item

def is_in_watchlist(db: Session, user_id: int, ticker: str):
    return db.query(models.Watchlist).filter(
        models.Watchlist.user_id==user_id,
        models.Watchlist.ticker==ticker
    ).first() is not None

def remove_watchlist(db: Session, user_id: int, ticker: str):
    existing = db.query(models.Watchlist).filter(models.Watchlist.user_id==user_id, models.Watchlist.ticker==ticker).first()
    if not existing: return False
    db.delete(existing); db.commit();
    return True

def list_watchlist(db: Session, user_id: int):
    return db.query(models.Watchlist).filter(models.Watchlist.user_id==user_id).all()

# Notifications
def create_notification(db: Session, user_id: int|None, title: str, message: str, data: str=None, ntype: str=None):
    n = models.Notification(user_id=user_id, title=title, message=message, data=data, type=ntype)
    db.add(n); db.commit(); db.refresh(n)
    return n

def list_notifications(db: Session, user_id: int=None, unread_only: bool=False):
    q = db.query(models.Notification)
    if user_id is not None:
        # Include both per-user and global notifications
        q = q.filter(or_(models.Notification.user_id==user_id, models.Notification.user_id.is_(None)))
    if unread_only:
        q = q.filter(models.Notification.is_read.is_(False))
    return q.order_by(models.Notification.created_at.desc()).all()

def mark_notification_read(db: Session, notification_id: int, user_id: int):
    n = db.query(models.Notification).filter(
        models.Notification.id==notification_id,
        or_(models.Notification.user_id==user_id, models.Notification.user_id.is_(None))
    ).first()
    if not n: return False
    n.is_read = True; db.commit(); return True

def delete_notification(db: Session, notification_id: int, user_id: int):
    n = db.query(models.Notification).filter(
        models.Notification.id==notification_id,
        or_(models.Notification.user_id==user_id, models.Notification.user_id.is_(None))
    ).first()
    if not n:
        return False
    db.delete(n)
    db.commit()
    return True


# Intrinsic assumptions
def upsert_intrinsic_assumption(db: Session, user_id: int, ticker: str, growth_rate: int, discount_rate: int, years: int):
    existing = db.query(models.IntrinsicAssumption).filter(
        models.IntrinsicAssumption.user_id == user_id,
        models.IntrinsicAssumption.ticker == ticker
    ).first()
    if existing:
        existing.growth_rate = growth_rate
        existing.discount_rate = discount_rate
        existing.years = years
        db.commit()
        db.refresh(existing)
        return existing

    item = models.IntrinsicAssumption(
        user_id=user_id,
        ticker=ticker,
        growth_rate=growth_rate,
        discount_rate=discount_rate,
        years=years,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_intrinsic_assumption(db: Session, user_id: int, ticker: str):
    return db.query(models.IntrinsicAssumption).filter(
        models.IntrinsicAssumption.user_id == user_id,
        models.IntrinsicAssumption.ticker == ticker
    ).first()


# Investment notes
def upsert_investment_note(db: Session, user_id: int, ticker: str, note: str):
    existing = db.query(models.InvestmentNote).filter(
        models.InvestmentNote.user_id == user_id,
        models.InvestmentNote.ticker == ticker
    ).first()
    if existing:
        existing.note = note
        db.commit()
        db.refresh(existing)
        return existing

    item = models.InvestmentNote(user_id=user_id, ticker=ticker, note=note)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_investment_note(db: Session, user_id: int, ticker: str):
    return db.query(models.InvestmentNote).filter(
        models.InvestmentNote.user_id == user_id,
        models.InvestmentNote.ticker == ticker
    ).first()

# Saved filters
def create_saved_filter(db: Session, user_id: int, name: str, conditions: str):
    sf = models.SavedFilter(user_id=user_id, name=name, conditions=conditions)
    db.add(sf)
    db.commit()
    db.refresh(sf)
    return sf

def get_saved_filters(db: Session, user_id: int):
    return db.query(models.SavedFilter).filter(models.SavedFilter.user_id == user_id).all()

def delete_saved_filter(db: Session, user_id: int, filter_id: int):
    sf = db.query(models.SavedFilter).filter(
        models.SavedFilter.id == filter_id,
        models.SavedFilter.user_id == user_id
    ).first()
    if not sf:
        return False
    db.delete(sf)
    db.commit()
    return True

