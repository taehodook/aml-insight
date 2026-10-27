import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('article_source',Path(__file__).parents[1]/'scripts/article_source.py')
source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)

class SourceTests(TestCase):
    def test_internal_urls_and_credentials_are_rejected(self):
        for url in ['file:///etc/passwd','https://user:password@example.com/','http://example.com:8080/']:
            with self.assertRaises(ValueError):source.public_url(url)
        with patch.object(source.socket,'getaddrinfo',return_value=[(0,0,0,'',('127.0.0.1',80))]):
            with self.assertRaises(ValueError):source.public_url('https://example.com/')
    def test_unrelated_page_is_not_accepted_as_article(self):
        self.assertGreater(source.overlap('보이스피싱 조직 적발','보이스피싱 조직 적발 - 언론사'),.8)
        self.assertLess(source.overlap('보이스피싱 조직 적발','언론사 홈페이지 광고 안내'),.4)
