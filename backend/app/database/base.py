#Every ORM model inherits from Base. SQLAlchemy uses it to: track tables , generate schemas , create migrations . Think of it as: ORM registry
from sqlalchemy.orm import declarative_base

Base = declarative_base()