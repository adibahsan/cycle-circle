FROM python:3.12-alpine

RUN pip install --no-cache-dir docker==7.1.0 prometheus-client==0.21.1

COPY exporter.py /exporter.py

EXPOSE 9487

CMD ["python", "/exporter.py"]
